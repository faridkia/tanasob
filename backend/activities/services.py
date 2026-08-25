"""Aggregation helpers for the activities app — powers the calorie chart
shown on the dashboard and the activities detail page."""

from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone

from .models import ActivityLog


def calorie_summary(member, days=7):
    today = timezone.localdate()
    start = today - timedelta(days=days - 1)

    logs = ActivityLog.objects.filter(member=member, created_at__date__gte=start)
    by_day = {}
    for log in logs:
        day = timezone.localtime(log.created_at).date()
        by_day[day] = by_day.get(day, 0) + log.calories_burned

    chart = [
        {'date': (start + timedelta(days=i)).isoformat(), 'calories': by_day.get(start + timedelta(days=i), 0)}
        for i in range(days)
    ]
    today_total = by_day.get(today, 0)
    week_total = sum(by_day.values())

    return {
        'today_calories': today_total,
        'week_calories': week_total,
        'chart': chart,
    }
