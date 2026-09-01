import io
from datetime import timedelta

import qrcode
from django.http import HttpResponse
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from common.permissions import IsAdmin

from .models import Member, Trainer, TrainerMemberAssignment, User
from .serializers import (
    AdminUserUpdateSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    MemberListSerializer,
    RegisterSerializer,
    TrainerListSerializer,
    TrainerMemberAssignmentSerializer,
    UpdateProfileSerializer,
    UserSerializer,
)


def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {'refresh': str(refresh), 'access': str(refresh.access_token)}


class RegisterView(generics.CreateAPIView):
    """Register a new Member or Trainer (FR-AUTH-1)."""

    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                'user': UserSerializer(user).data,
                'tokens': _tokens_for(user),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """Log in with email + password and receive JWT tokens (FR-AUTH-2)."""

    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        return Response(
            {
                'user': UserSerializer(user).data,
                'tokens': _tokens_for(user),
            }
        )


class MeView(generics.RetrieveUpdateAPIView):
    """Get or update the current user's own profile (FR-AUTH-4)."""

    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return UpdateProfileSerializer
        return UserSerializer


class MyQRCodeView(APIView):
    """PNG QR code encoding the member's check-in token (FR-ATT scan flow).

    Members display this on their phone; trainers scan it with
    `/attendance/check-in/` (passing the decoded ``token``) to check them
    into a session without looking anyone up manually.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_member:
            raise PermissionDenied('Only members have a check-in QR code.')
        token = request.user.member_profile.qr_token
        image = qrcode.make(f'TANASOB-MEMBER:{token}')
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        return HttpResponse(buffer.getvalue(), content_type='image/png')


class MyFaceEnrollView(APIView):
    """Member saves/updates the face descriptor used for face-recognition
    check-in (see bookings.services.match_face). Only the 128-number
    embedding is stored — never a photo."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.is_member:
            raise PermissionDenied('Only members can enroll a face for check-in.')
        descriptor = request.data.get('descriptor')
        if not isinstance(descriptor, list) or len(descriptor) != 128:
            return Response(
                {'descriptor': 'Expected a 128-number face descriptor.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        member = request.user.member_profile
        member.face_descriptor = descriptor
        member.save(update_fields=['face_descriptor'])
        return Response({'detail': 'Face enrolled successfully.'})

    def delete(self, request):
        if not request.user.is_member:
            raise PermissionDenied('Only members can manage their own face enrollment.')
        member = request.user.member_profile
        member.face_descriptor = None
        member.save(update_fields=['face_descriptor'])
        return Response({'detail': 'Face enrollment removed.'})


class ChangePasswordView(APIView):
    """Change the current user's password."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'detail': 'Password updated successfully.'})


class AdminUserListCreateView(generics.ListCreateAPIView):
    """Admin manages Trainer/Member accounts (FR-AUTH-5, US-A3).

    GET: list all trainers/members (optionally ?role=TRAINER|MEMBER).
    POST: create a new trainer/member account (reuses RegisterSerializer —
    same account-creation logic as self-registration, just admin-triggered).
    """

    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = User.objects.filter(
            role__in=[User.Role.MEMBER, User.Role.TRAINER],
            organization=self.request.user.organization,
        ).order_by('full_name')
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)
        return qs

    def get_serializer_class(self):
        return RegisterSerializer if self.request.method == 'POST' else UserSerializer

    def create(self, request, *args, **kwargs):
        # Admin-created accounts always join the creating admin's own gym —
        # never a client-supplied org id.
        data = request.data.copy()
        data['organization'] = request.user.organization_id
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    """Admin edits or activates/deactivates a single Trainer/Member account."""

    permission_classes = [IsAdmin]

    def get_queryset(self):
        return User.objects.filter(
            role__in=[User.Role.MEMBER, User.Role.TRAINER],
            organization=self.request.user.organization,
        )

    def get_serializer_class(self):
        return AdminUserUpdateSerializer if self.request.method in ('PUT', 'PATCH') else UserSerializer


class TrainerListView(generics.ListAPIView):
    """Minimal trainer roster — admin picker when scheduling a class session."""

    serializer_class = TrainerListSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return Trainer.objects.filter(
            user__organization=self.request.user.organization
        ).select_related('user').order_by('user__full_name')


class TrainerPublicListView(generics.ListAPIView):
    """The trainer roster everyone in the gym can browse — backs the "our
    trainers" grid that links through to each profile."""

    serializer_class = TrainerListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Trainer.objects.filter(
            user__organization=self.request.user.organization
        ).select_related('user').order_by('user__full_name')


class TrainerProfileView(APIView):
    """One trainer's public page: who they are, what they teach, and how
    much of it they've done.

    Student figures are deliberately aggregate. A trainer's roster is other
    members' private business, so this returns counts — never names — to
    anyone but the trainer themselves and admins.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from django.db.models import Count, Q
        from django.utils import timezone

        from bookings.models import Attendance
        from classes.models import ClassSession, GymClass

        org = request.user.organization
        try:
            trainer = Trainer.objects.select_related('user').get(pk=pk, user__organization=org)
        except Trainer.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        today = timezone.localdate()
        sessions = ClassSession.objects.filter(trainer=trainer)
        held = sessions.filter(session_date__lt=today)
        upcoming = (
            sessions.filter(session_date__gte=today)
            .select_related('gym_class')
            .annotate(booked=Count('bookings', filter=Q(bookings__status='CONFIRMED'), distinct=True))
            .order_by('session_date', 'start_time')[:10]
        )

        # Distinct people taught, counted without ever exposing who they are.
        students_taught = (
            Attendance.objects.filter(session__trainer=trainer)
            .values('member_id').distinct().count()
        )
        active_students = TrainerMemberAssignment.objects.filter(
            trainer=trainer, status=TrainerMemberAssignment.Status.ACTIVE
        ).count()

        class_ids = held.values_list('gym_class_id', flat=True).distinct()
        classes = GymClass.objects.filter(id__in=class_ids).values('id', 'name', 'category')

        return Response({
            'id': trainer.id,
            'full_name': trainer.user.full_name,
            'specialization': trainer.specialization,
            'bio': trainer.bio,
            'bio_html': trainer.bio_html,
            'photo': trainer.photo.url if trainer.photo else None,
            'experience_years': trainer.experience_years,
            'stats': {
                'sessions_held': held.count(),
                'students_taught': students_taught,
                'active_students': active_students,
                'total_check_ins': Attendance.objects.filter(session__trainer=trainer).count(),
                'classes_taught': len(classes),
            },
            'classes': list(classes),
            'upcoming_sessions': [
                {
                    'id': s.id,
                    'gym_class': s.gym_class.name,
                    'gym_class_id': s.gym_class_id,
                    'session_date': s.session_date,
                    'start_time': s.start_time,
                    'capacity': s.capacity,
                    'booked': s.booked,
                }
                for s in upcoming
            ],
        })


class MemberPublicProfileView(APIView):
    """A member's profile as other members see it.

    `is_profile_public` gates the ACTIVITY, not the existence of the person:
    a private profile still returns the name and tier so leaderboards and
    mentions keep working, but the classes they attend, their streak and
    their check-in history are withheld. The owner and admins always get
    the full picture — hiding someone's data from themselves would be
    surprising, not private.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from django.utils import timezone

        from bookings.models import Attendance
        from progress.gamification import points_for_member

        org = request.user.organization
        try:
            member = Member.objects.select_related('user').get(pk=pk, user__organization=org)
        except Member.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        viewer_is_owner = request.user.is_member and request.user.member_profile.id == member.id
        can_see_detail = member.user.is_profile_public or viewer_is_owner or request.user.is_admin_role

        points = points_for_member(member)
        payload = {
            'member_id': member.id,
            'full_name': member.user.full_name,
            'is_public': member.user.is_profile_public,
            'is_me': viewer_is_owner,
            'can_see_detail': can_see_detail,
            'tier': points['tier'],
            'tier_emoji': points['tier_emoji'],
            'member_since': member.created_at.date(),
        }
        if not can_see_detail:
            return Response(payload)

        attendances = (
            Attendance.objects.filter(member=member)
            .select_related('session__gym_class', 'session__trainer__user')
            .order_by('-check_in_time')
        )
        recent = attendances[:10]
        thirty_days_ago = timezone.now() - timedelta(days=30)
        payload.update({
            'points': points['points'],
            'stats': {
                'total_check_ins': attendances.count(),
                'check_ins_30d': attendances.filter(check_in_time__gte=thirty_days_ago).count(),
                'classes_tried': attendances.values('session__gym_class_id').distinct().count(),
            },
            'recent_classes': [
                {
                    'gym_class': a.session.gym_class.name,
                    'trainer_name': a.session.trainer.user.full_name,
                    'date': a.check_in_time.date(),
                }
                for a in recent
            ],
        })
        return Response(payload)


class MemberListView(generics.ListAPIView):
    """Minimal member roster — admin picker when assigning a trainer."""

    serializer_class = MemberListSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return Member.objects.filter(
            user__organization=self.request.user.organization
        ).select_related('user').order_by('user__full_name')


class TrainerMemberAssignmentView(generics.ListCreateAPIView):
    """List assignments and create a new trainer-member assignment (FR-TRN-2).

    - Admins see/manage all assignments.
    - Trainers see the members currently assigned to them (FR-TRN-3).
    - Members see their own assigned trainers.
    """

    serializer_class = TrainerMemberAssignmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = TrainerMemberAssignment.objects.select_related('member__user', 'trainer__user')
        if user.is_admin_role:
            return qs.filter(trainer__user__organization=user.organization)
        if user.is_trainer:
            return qs.filter(trainer__user=user)
        return qs.filter(member__user=user)

    def perform_create(self, serializer):
        if not (self.request.user.is_admin_role or self.request.user.is_trainer):
            raise PermissionDenied('Only admins or trainers can create assignments.')
        serializer.save()


class AssignmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve / update (e.g. mark ENDED) / delete an assignment."""

    serializer_class = TrainerMemberAssignmentSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return TrainerMemberAssignment.objects.filter(
            trainer__user__organization=self.request.user.organization
        )
