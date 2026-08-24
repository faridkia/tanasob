"""
Views for the classes app.

Admins manage gym classes and sessions; members browse upcoming sessions with
filters (FR-CLS-3). Trainers can list their own sessions.
"""

from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

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
    serializer_class = GymClassSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return GymClass.objects.filter(organization=self.request.user.organization)


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
