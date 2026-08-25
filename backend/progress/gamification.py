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

TIERS = [
    (700, 'الماس', '💎'),
    (350, 'طلایی', '🥇'),
    (150, 'نقره‌ای', '🥈'),
    (50, 'برنزی', '🥉'),
    (0, 'تازه‌کار', '🌱'),
]

POINTS_PER_ATTENDANCE = 10
POINTS_PER_PROGRESS_ENTRY = 5
ACTIVE_SUBSCRIPTION_BONUS = 20


def tier_for(points):
    for threshold, label, emoji in TIERS:
        if points >= threshold:
            return label, emoji, threshold
    return TIERS[-1][1], TIERS[-1][2], 0


def next_tier_for(points):
    for threshold, label, emoji in reversed(TIERS):
        if points < threshold:
            return label, emoji, threshold
    return None


def leaderboard(organization, limit=20):
    """Ranked list of every member in ``organization`` by computed points."""
    members = (
        Member.objects.filter(user__organization=organization)
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
        tier_label, tier_emoji, _ = tier_for(points)
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
    """Weekly/monthly attendance goals (real check-ins vs a sensible fixed
    target) and today's calorie target — the sum of meal items across the
    member's active diet plan(s). No separate "goal" model: the targets are
    fixed, sane defaults, and the progress is always derived from actual
    Attendance/DietPlan data so it can't drift out of sync.
    """
    from bookings.models import Attendance
    from plans.models import DietPlan

    now = timezone.now()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    weekly_count = Attendance.objects.filter(member=member, check_in_time__gte=week_ago).count()
    monthly_count = Attendance.objects.filter(member=member, check_in_time__gte=month_ago).count()

    calorie_target = DietPlan.objects.filter(member=member, is_archived=False).aggregate(
        total=Sum('items__calories')
    )['total'] or 0

    return {
        'weekly': {'count': weekly_count, 'target': WEEKLY_SESSION_TARGET},
        'monthly': {'count': monthly_count, 'target': MONTHLY_SESSION_TARGET},
        'calorie_target': calorie_target,
    }


def points_for_member(member):
    attendance_count = member.attendances.count()
    progress_count = member.progress_entries.count()
    points = (
        attendance_count * POINTS_PER_ATTENDANCE
        + progress_count * POINTS_PER_PROGRESS_ENTRY
        + (ACTIVE_SUBSCRIPTION_BONUS if has_active_subscription(member) else 0)
    )
    tier_label, tier_emoji, tier_min = tier_for(points)
    next_tier = next_tier_for(points)
    return {
        'points': points,
        'attendance_count': attendance_count,
        'progress_count': progress_count,
        'tier': tier_label,
        'tier_emoji': tier_emoji,
        'tier_min': tier_min,
        'next_tier': (
            {'tier': next_tier[0], 'tier_emoji': next_tier[1], 'points_needed': next_tier[2] - points}
            if next_tier else None
        ),
    }
