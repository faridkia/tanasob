"""
Views for the progress app.

Members log and view their own body progress (FR-PROG-1, FR-PROG-2).
Trainers view progress of their assigned members (FR-PROG-3).
"""

from rest_framework import generics

from accounts.models import TrainerMemberAssignment

from .models import BodyProgress
from .serializers import BodyProgressSerializer


class BodyProgressListCreateView(generics.ListCreateAPIView):
    """Members log progress and see their own history (FR-PROG-1, FR-PROG-2)."""

    serializer_class = BodyProgressSerializer

    def get_queryset(self):
        user = self.request.user
        qs = BodyProgress.objects.select_related('member__user')
        if user.is_member:
            return qs.filter(member=user.member_profile)
        if user.is_trainer:
            member_ids = TrainerMemberAssignment.objects.filter(
                trainer__user=user, status='ACTIVE'
            ).values_list('member_id', flat=True)
            return qs.filter(member_id__in=member_ids)
        return qs

    def perform_create(self, serializer):
        serializer.save(member=self.request.user.member_profile)


class BodyProgressDetailView(generics.RetrieveAPIView):
    serializer_class = BodyProgressSerializer

    def get_queryset(self):
        user = self.request.user
        qs = BodyProgress.objects.select_related('member__user')
        if user.is_member:
            return qs.filter(member=user.member_profile)
        if user.is_trainer:
            member_ids = TrainerMemberAssignment.objects.filter(
                trainer__user=user, status='ACTIVE'
            ).values_list('member_id', flat=True)
            return qs.filter(member_id__in=member_ids)
        return qs
