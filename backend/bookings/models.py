"""
Models for the bookings app: session bookings and attendance records.

Mapping to the SRS data model: Booking (6.10), Attendance (6.11).
"""

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Booking(models.Model):
    """A member's reservation for a specific ClassSession (SRS 6.10)."""

    class Status(models.TextChoices):
        CONFIRMED = 'CONFIRMED', 'Confirmed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    member = models.ForeignKey(
        'accounts.Member', on_delete=models.CASCADE, related_name='bookings'
    )
    session = models.ForeignKey(
        'classes.ClassSession', on_delete=models.CASCADE, related_name='bookings'
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.CONFIRMED)
    booked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # FR-BOOK-4: a member may not book the same session more than once.
        unique_together = ('member', 'session')
        ordering = ['-booked_at']

    def __str__(self):
        return f'{self.member.user.email} -> {self.session} ({self.status})'

    def clean(self):
        # FR-BOOK-2: prevent booking a full session.
        if self.status == self.Status.CONFIRMED and self.session_id:
            if not self.pk:  # new booking
                if self.session.is_full:
                    raise ValidationError('This session has reached its maximum capacity.')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Attendance(models.Model):
    """Record of a member's actual presence at a ClassSession (SRS 6.11)."""

    member = models.ForeignKey(
        'accounts.Member', on_delete=models.CASCADE, related_name='attendances'
    )
    session = models.ForeignKey(
        'classes.ClassSession', on_delete=models.CASCADE, related_name='attendances'
    )
    check_in_time = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('member', 'session')
        ordering = ['-check_in_time']

    def __str__(self):
        return f'{self.member.user.email} @ {self.session}'
