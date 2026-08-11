"""
Views for the bookings app.

Members book/cancel sessions and self check-in; trainers mark attendance for
their sessions; admins and trainers view attendance history (FR-ATT-3).
"""

from django.core.exceptions import ValidationError
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdmin, IsMember, IsTrainer

from classes.models import ClassSession

from .models import Attendance, Booking
from .serializers import AttendanceSerializer, BookingSerializer
from .services import cancel_booking, create_booking


class BookingListCreateView(generics.ListCreateAPIView):
    """List bookings / create a booking (FR-BOOK-1..FR-BOOK-5).

    - Members see their own bookings and create new ones.
    - Trainers see bookings for their own sessions.
    - Admins see all bookings.
    """

    serializer_class = BookingSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Booking.objects.select_related('member__user', 'session__gym_class', 'session__trainer__user')
        if user.is_member:
            return qs.filter(member=user.member_profile)
        if user.is_trainer:
            return qs.filter(session__trainer__user=user)
        if user.is_admin_role:
            return qs
        return qs.none()

    def create(self, request, *args, **kwargs):
        if not request.user.is_member:
            raise PermissionDenied('Only members can book sessions.')
        session_id = request.data.get('session')
        try:
            session = ClassSession.objects.get(pk=session_id)
        except (ClassSession.DoesNotExist, ValueError, TypeError):
            return Response({'session': 'Session not found.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            booking = create_booking(request.user.member_profile, session)
        except ValidationError as exc:
            raise _to_drf_error(exc)
        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


class BookingDetailView(generics.RetrieveAPIView):
    """Retrieve a single booking (member owner / trainer of session / admin)."""

    serializer_class = BookingSerializer

    def get_queryset(self):
        return Booking.objects.select_related('member__user', 'session')


class CancelBookingView(APIView):
    """Cancel a booking before the session starts (FR-BOOK-3)."""

    def post(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk)
        except Booking.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if not (user.is_admin_role or booking.member.user == user):
            raise PermissionDenied('You can only cancel your own bookings.')
        try:
            cancel_booking(booking)
        except ValidationError as exc:
            raise _to_drf_error(exc)
        return Response(BookingSerializer(booking).data)


class AttendanceListView(generics.ListAPIView):
    """View attendance history per session / per member (FR-ATT-3)."""

    serializer_class = AttendanceSerializer

    def get_permissions(self):
        # Only trainers and admins view attendance history.
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsTrainer()]

    def get_queryset(self):
        user = self.request.user
        qs = Attendance.objects.select_related('member__user', 'session__gym_class')
        if user.is_trainer:
            qs = qs.filter(session__trainer__user=user)
        # Admin sees all; members shouldn't reach here but if they do, scope to own.
        elif not user.is_admin_role:
            qs = qs.filter(member__user=user)

        session_id = self.request.query_params.get('session')
        member_id = self.request.query_params.get('member')
        if session_id:
            qs = qs.filter(session_id=session_id)
        if member_id:
            qs = qs.filter(member_id=member_id)
        return qs


class CheckInView(APIView):
    """Member self check-in (FR-ATT-1) or trainer marks attendance."""

    def post(self, request):
        member = None
        user = request.user
        if user.is_member:
            member = user.member_profile
        elif user.is_trainer:
            member_id = request.data.get('member')
            if not member_id:
                return Response(
                    {'member': 'Trainer must specify a member to check in.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            from accounts.models import Member

            try:
                member = Member.objects.get(pk=member_id)
            except Member.DoesNotExist:
                return Response({'member': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            raise PermissionDenied('Only members and trainers can check in.')

        session_id = request.data.get('session')
        try:
            session = ClassSession.objects.get(pk=session_id)
        except (ClassSession.DoesNotExist, ValueError, TypeError):
            return Response({'session': 'Session not found.'}, status=status.HTTP_400_BAD_REQUEST)

        attendance, created = Attendance.objects.get_or_create(member=member, session=session)
        return Response(
            AttendanceSerializer(attendance).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


def _to_drf_error(exc):
    from rest_framework.exceptions import ValidationError as DRFValidationError

    if hasattr(exc, 'message_dict'):
        return DRFValidationError(exc.message_dict)
    return DRFValidationError(str(exc))
