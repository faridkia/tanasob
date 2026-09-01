"""
Body progress tracking model (SRS 6.16).
"""

from django.db import models


class BodyProgress(models.Model):
    """A snapshot of a member's physical measurements at a point in time (SRS 6.16)."""

    member = models.ForeignKey(
        'accounts.Member', on_delete=models.CASCADE, related_name='progress_entries'
    )
    recorded_at = models.DateField()
    weight_kg = models.DecimalField(max_digits=6, decimal_places=2)
    body_fat_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    waist_cm = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-recorded_at']

    def __str__(self):
        return f'{self.member.user.full_name} @ {self.recorded_at} ({self.weight_kg}kg)'


class MemberGoal(models.Model):
    """A member's own targets.

    Until now the weekly/monthly targets were constants in gamification.py,
    identical for everyone — which is wrong for a gym where one member trains
    twice a week and another six times. These are per-member and editable;
    `goals_for_member` falls back to the old defaults when a member has
    never set them, so nothing breaks for existing accounts.
    """

    member = models.OneToOneField(
        'accounts.Member', on_delete=models.CASCADE, related_name='goal'
    )
    weekly_sessions = models.PositiveIntegerField(default=4)
    monthly_sessions = models.PositiveIntegerField(default=12)
    # Calories the member wants to BURN per day through activity. Distinct
    # from the diet plan's intake target, which the trainer sets.
    daily_calories = models.PositiveIntegerField(default=400)
    target_weight_kg = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    note = models.CharField(max_length=200, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Goals: {self.member.user.full_name}'
