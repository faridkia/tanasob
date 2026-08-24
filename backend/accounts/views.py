import io

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
        qs = User.objects.filter(role__in=[User.Role.MEMBER, User.Role.TRAINER]).order_by('full_name')
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)
        return qs

    def get_serializer_class(self):
        return RegisterSerializer if self.request.method == 'POST' else UserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    """Admin edits or activates/deactivates a single Trainer/Member account."""

    queryset = User.objects.filter(role__in=[User.Role.MEMBER, User.Role.TRAINER])
    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        return AdminUserUpdateSerializer if self.request.method in ('PUT', 'PATCH') else UserSerializer


class TrainerListView(generics.ListAPIView):
    """Minimal trainer roster — admin picker when scheduling a class session."""

    queryset = Trainer.objects.select_related('user').order_by('user__full_name')
    serializer_class = TrainerListSerializer
    permission_classes = [IsAdmin]


class MemberListView(generics.ListAPIView):
    """Minimal member roster — admin picker when assigning a trainer."""

    queryset = Member.objects.select_related('user').order_by('user__full_name')
    serializer_class = MemberListSerializer
    permission_classes = [IsAdmin]


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
            return qs
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
        return TrainerMemberAssignment.objects.all()
