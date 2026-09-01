"""
Views for the progress app.

Members log and view their own body progress (FR-PROG-1, FR-PROG-2).
Trainers view progress of their assigned members (FR-PROG-3).
"""

from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Member, TrainerMemberAssignment
from common.permissions import IsAdmin
from memberships.models import LeaderboardReward

from .coaching import daily_tasks, suggestions
from .gamification import goals_for_member, leaderboard, points_for_member
from .models import BodyProgress, MemberGoal
from .serializers import BodyProgressSerializer, MemberGoalSerializer

# rank -> (one-time prize, standing discount kept afterwards)
LEADERBOARD_REWARDS = {1: (15, 3), 2: (10, 2), 3: (5, 1)}


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


class GrantLeaderboardRewardsView(APIView):
    """Admin's "close out the leaderboard" action — grants a membership
    discount (30% / 20% / 10%) to whoever is currently 1st/2nd/3rd. There's
    no automatic schedule; the admin decides the date by clicking this,
    e.g. at the end of the month. A member who already holds an unredeemed
    reward is skipped rather than stacked."""

    permission_classes = [IsAdmin]

    def post(self, request):
        rows = leaderboard(request.user.organization, limit=3)
        granted = []
        skipped = []
        for row in rows:
            tier = LEADERBOARD_REWARDS.get(row['rank'])
            if not tier:
                continue
            percent, residual = tier
            member = Member.objects.select_related('user').get(pk=row['member_id'])
            if LeaderboardReward.objects.filter(member=member, is_redeemed=False).exists():
                skipped.append(member.user.full_name)
                continue
            LeaderboardReward.objects.create(
                member=member, rank=row['rank'], percent=percent, residual_percent=residual,
            )
            granted.append({'member_name': member.user.full_name, 'rank': row['rank'], 'percent': percent})
        return Response({'granted': granted, 'skipped': skipped})


class LeaderboardHistoryView(APIView):
    """Past winners, reconstructed from the rewards that were granted.

    There is no stored leaderboard snapshot and there doesn't need to be:
    every time an admin closes out a period we write LeaderboardReward rows
    carrying member, rank and the timestamp. Grouping those by grant date
    gives the podium for each past period for free, and it can never
    disagree with the discounts people actually hold.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        rewards = (
            LeaderboardReward.objects.filter(member__user__organization=request.user.organization)
            .select_related('member__user')
            .order_by('-granted_at', 'rank')
        )
        my_member_id = request.user.member_profile.id if request.user.is_member else None
        periods = {}
        for reward in rewards:
            key = reward.granted_at.date().isoformat()
            bucket = periods.setdefault(key, {})
            # An admin may run "grant rewards" more than once in a day (a
            # correction, a re-run after redemption). Keep one entry per
            # member per day — their best rank — so a period shows a real
            # podium instead of the same person twice.
            existing = bucket.get(reward.member_id)
            if existing and existing['rank'] <= reward.rank:
                continue
            bucket[reward.member_id] = {
                'rank': reward.rank,
                'percent': reward.percent,
                'member_id': reward.member_id,
                # Opting out of the leaderboard also removes you from the
                # historical podium — otherwise the archive would keep
                # publishing exactly what the toggle was meant to hide.
                'full_name': reward.member.user.full_name if reward.member.show_on_leaderboard else 'عضو ناشناس',
                'is_me': reward.member_id == my_member_id,
            }
        return Response({
            'periods': [
                {'granted_on': date, 'winners': sorted(bucket.values(), key=lambda w: w['rank'])}
                for date, bucket in list(periods.items())[:12]
            ]
        })


class MyPointsView(APIView):
    """The current member's own points/tier breakdown."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_member:
            return Response({'detail': 'Only members have a points profile.'}, status=400)
        return Response(points_for_member(request.user.member_profile))


class MyCoachView(APIView):
    """Today's checklist plus the ranked nudges behind the dashboard card."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_member:
            return Response({'detail': 'Only members have a daily plan.'}, status=400)
        member = request.user.member_profile
        tasks, done = daily_tasks(member)
        return Response({
            'tasks': tasks,
            'done': done,
            'total': len(tasks),
            'percent': round(done / len(tasks) * 100) if tasks else 0,
            'suggestions': suggestions(member),
        })


class MyGoalSettingsView(generics.RetrieveUpdateAPIView):
    """The member's own targets — read and edit. Created on first access so
    the page always has something to show."""

    serializer_class = MemberGoalSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        if not self.request.user.is_member:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only members have goals.')
        goal, _ = MemberGoal.objects.get_or_create(member=self.request.user.member_profile)
        return goal


class MyGoalsView(APIView):
    """Weekly/monthly attendance goals + today's calorie target."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_member:
            return Response({'detail': 'Only members have goals.'}, status=400)
        return Response(goals_for_member(request.user.member_profile))
