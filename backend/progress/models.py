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
