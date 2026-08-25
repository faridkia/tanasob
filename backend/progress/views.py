"""
Views for the progress app.

Members log and view their own body progress (FR-PROG-1, FR-PROG-2).
Trainers view progress of their assigned members (FR-PROG-3).
"""

from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import TrainerMemberAssignment

from .gamification import goals_for_member, leaderboard, points_for_member
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


class LeaderboardView(APIView):
    """Gym-wide points leaderboard, computed from attendance/progress/
    subscription activity — never a stored score, so it can't drift."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = leaderboard(request.user.organization)
        my_member_id = request.user.member_profile.id if request.user.is_member else None
        return Response({'leaderboard': rows, 'my_member_id': my_member_id})


class MyPointsView(APIView):
    """The current member's own points/tier breakdown."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_member:
            return Response({'detail': 'Only members have a points profile.'}, status=400)
        return Response(points_for_member(request.user.member_profile))


class MyGoalsView(APIView):
    """Weekly/monthly attendance goals + today's calorie target."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_member:
            return Response({'detail': 'Only members have goals.'}, status=400)
        return Response(goals_for_member(request.user.member_profile))
