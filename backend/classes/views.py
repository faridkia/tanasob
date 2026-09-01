"""
Views for the classes app.

Admins manage gym classes and sessions; members browse upcoming sessions with
filters (FR-CLS-3). Trainers can list their own sessions.
"""

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdmin

from .models import ClassSession, GymClass
from .serializers import ClassSessionSerializer, GymClassSerializer


class GymClassListCreateView(generics.ListCreateAPIView):
    """List (anyone authenticated) / create (admin) gym classes (FR-CLS-1)."""

    serializer_class = GymClassSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return GymClass.objects.filter(organization=self.request.user.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)


class GymClassDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Read is open to everyone in the gym (this backs the class's own
    page); writing stays admin-only."""

    serializer_class = GymClassSerializer

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return GymClass.objects.filter(organization=self.request.user.organization)


class GymClassHistoryView(APIView):
    """Sessions of this class that have already happened, newest first, with
    what actually came of them — how many booked, how many turned up.

    This is the "تجربه کلاس‌های قبلی" panel: a member deciding whether to
    book can see whether the class actually runs and fills up.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        org = request.user.organization
        try:
            gym_class = GymClass.objects.get(pk=pk, organization=org)
        except GymClass.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        today = timezone.localdate()
        sessions = (
            ClassSession.objects.filter(gym_class=gym_class, session_date__lt=today)
            .select_related('trainer__user')
            .annotate(
                booked=Count('bookings', filter=Q(bookings__status='CONFIRMED'), distinct=True),
                attended=Count('attendances', distinct=True),
            )
            .order_by('-session_date', '-start_time')[:20]
        )
        rows = [
            {
                'id': s.id,
                'session_date': s.session_date,
                'start_time': s.start_time,
                'end_time': s.end_time,
                'trainer_name': s.trainer.user.full_name,
                'trainer_id': s.trainer_id,
                'capacity': s.capacity,
                'booked': s.booked,
                'attended': s.attended,
            }
            for s in sessions
        ]
        held = len(rows)
        total_attended = sum(r['attended'] for r in rows)
        total_booked = sum(r['booked'] for r in rows)
        return Response({
            'sessions': rows,
            'summary': {
                'sessions_held': held,
                'total_attended': total_attended,
                'avg_attendance': round(total_attended / held, 1) if held else 0,
                'show_up_rate': round(total_attended / total_booked * 100) if total_booked else 0,
            },
        })


class ClassSessionListCreateView(generics.ListCreateAPIView):
    """List sessions (filterable) / create a session (admin) (FR-CLS-2, FR-CLS-3)."""

    serializer_class = ClassSessionSerializer
    filterset_fields = ['gym_class', 'trainer', 'session_date']
    ordering_fields = ['session_date', 'start_time']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = ClassSession.objects.select_related('gym_class', 'trainer__user').filter(
            gym_class__organization=self.request.user.organization
        )
        user = self.request.user

        # Trainers see their own sessions by default (US-T2).
        if user.is_trainer:
            qs = qs.filter(trainer__user=user)

        # Members only see upcoming sessions.
        if user.is_member:
            qs = qs.filter(session_date__gte=timezone.now().date())

        # Optional query params: from / to date range.
        date_from = self.request.query_params.get('from')
        date_to = self.request.query_params.get('to')
        if date_from:
            qs = qs.filter(session_date__gte=date_from)
        if date_to:
            qs = qs.filter(session_date__lte=date_to)
        return qs


class ClassSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ClassSessionSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return ClassSession.objects.filter(gym_class__organization=self.request.user.organization)
