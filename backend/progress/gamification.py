"""Lightweight, computed-on-the-fly gamification layer.

Points aren't stored anywhere — they're derived each request from data that
already exists (attendance, logged progress entries, an active subscription),
so there's no new source of truth to keep in sync and no risk of the score
drifting from what actually happened.
"""

from datetime import timedelta

from django.db.models import Count, Sum
from django.utils import timezone

from accounts.models import Member
from memberships.services import has_active_subscription

# Tiers are earned by ATTENDANCE, not by the composite points score.
# Points mix in progress logs and an active-subscription bonus, so a tier
# derived from them could be bought rather than trained for. Sessions are
# the honest measure of "has actually shown up", and each threshold is
# roughly a doubling of the last:
#
#   برنزی   36 جلسه  ≈ 3 ماه    → 3%
#   نقره‌ای  72 جلسه  ≈ 6 ماه    → 7%
#   طلایی  144 جلسه  ≈ 1 سال    → 10%
#   الماس  288 جلسه  ≈ 2 سال    → 15%
#
# (threshold_sessions, label, emoji, discount_percent)
TIERS = [
    (288, 'الماس', '💎', 15),
    (144, 'طلایی', '🥇', 10),
    (72, 'نقره‌ای', '🥈', 7),
    (36, 'برنزی', '🥉', 3),
    (0, 'تازه‌کار', '🌱', 0),
]

POINTS_PER_ATTENDANCE = 10
POINTS_PER_PROGRESS_ENTRY = 5
ACTIVE_SUBSCRIPTION_BONUS = 20


def tier_for(attendance_count):
    """Tier reached with this many attended sessions."""
    for threshold, label, emoji, discount in TIERS:
        if attendance_count >= threshold:
            return label, emoji, threshold, discount
    last = TIERS[-1]
    return last[1], last[2], 0, last[3]


def next_tier_for(attendance_count):
    """The next tier up, or None at the top."""
    for threshold, label, emoji, discount in reversed(TIERS):
        if attendance_count < threshold:
            return label, emoji, threshold, discount
    return None


def tier_discount_for(member):
    """Loyalty discount earned purely by turning up."""
    return tier_for(member.attendances.count())[3]


def leaderboard(organization, limit=20):
    """Ranked list of every member in ``organization`` by computed points."""
    members = (
        # Opting out removes you from the ranking entirely rather than
        # anonymising you — a "hidden" row that still shifts everyone else's
        # rank would leak the fact that someone is above them.
        Member.objects.filter(user__organization=organization, show_on_leaderboard=True)
        .select_related('user')
        .annotate(attendance_count=Count('attendances', distinct=True))
        .annotate(progress_count=Count('progress_entries', distinct=True))
    )

    rows = []
    for member in members:
        points = (
            member.attendance_count * POINTS_PER_ATTENDANCE
            + member.progress_count * POINTS_PER_PROGRESS_ENTRY
            + (ACTIVE_SUBSCRIPTION_BONUS if has_active_subscription(member) else 0)
        )
        tier_label, tier_emoji, _, _ = tier_for(member.attendance_count)
        rows.append({
            'member_id': member.id,
            'full_name': member.user.full_name,
            'points': points,
            'attendance_count': member.attendance_count,
            'tier': tier_label,
            'tier_emoji': tier_emoji,
        })

    rows.sort(key=lambda r: r['points'], reverse=True)
    for index, row in enumerate(rows, start=1):
        row['rank'] = index
    return rows[:limit]


WEEKLY_SESSION_TARGET = 4
MONTHLY_SESSION_TARGET = 12


def goals_for_member(member):
    """Progress against the member's targets.

    Targets come from their own MemberGoal when they've set one, otherwise
    the shared defaults. Progress itself is always derived from real
    Attendance/DietPlan rows, so it can't drift out of sync with what
    actually happened.
    """
    from bookings.models import Attendance
    from plans.models import DietPlan

    now = timezone.now()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    weekly_count = Attendance.objects.filter(member=member, check_in_time__gte=week_ago).count()
    monthly_count = Attendance.objects.filter(member=member, check_in_time__gte=month_ago).count()

    # The member's own targets when they've set them; the old fixed values
    # otherwise, so accounts that never opened the goals page still work.
    goal = getattr(member, 'goal', None)
    weekly_target = goal.weekly_sessions if goal else WEEKLY_SESSION_TARGET
    monthly_target = goal.monthly_sessions if goal else MONTHLY_SESSION_TARGET
    burn_target = goal.daily_calories if goal else 400

    calorie_target = DietPlan.objects.filter(member=member, is_archived=False).aggregate(
        total=Sum('items__calories')
    )['total'] or 0

    return {
        'weekly': {'count': weekly_count, 'target': weekly_target},
        'monthly': {'count': monthly_count, 'target': monthly_target},
        'calorie_target': calorie_target,
        'burn_target': burn_target,
        'target_weight_kg': float(goal.target_weight_kg) if goal and goal.target_weight_kg else None,
        'note': goal.note if goal else '',
    }


def points_for_member(member):
    attendance_count = member.attendances.count()
    progress_count = member.progress_entries.count()
    points = (
        attendance_count * POINTS_PER_ATTENDANCE
        + progress_count * POINTS_PER_PROGRESS_ENTRY
        + (ACTIVE_SUBSCRIPTION_BONUS if has_active_subscription(member) else 0)
    )
    tier_label, tier_emoji, tier_min, tier_discount = tier_for(attendance_count)
    next_tier = next_tier_for(attendance_count)
    return {
        'points': points,
        'attendance_count': attendance_count,
        'progress_count': progress_count,
        'tier': tier_label,
        'tier_emoji': tier_emoji,
        'tier_min': tier_min,
        'tier_discount': tier_discount,
        'next_tier': (
            {
                'tier': next_tier[0],
                'tier_emoji': next_tier[1],
                'discount': next_tier[3],
                # Sessions still to attend — the tier is earned by showing
                # up, so this counts sessions rather than points.
                'sessions_needed': next_tier[2] - attendance_count,
            }
            if next_tier else None
        ),
    }
