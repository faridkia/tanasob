"""
Notification model for system-generated alerts (SRS 6.18).

Notifications are created by other apps (bookings, messaging, memberships)
through the ``notify`` helper in ``notifications.services``.
"""

from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Type(models.TextChoices):
        SUBSCRIPTION = 'SUBSCRIPTION', 'Subscription'
        BOOKING = 'BOOKING', 'Booking'
        MESSAGE = 'MESSAGE', 'Message'
        SESSION_REMINDER = 'SESSION_REMINDER', 'Session reminder'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    type = models.CharField(max_length=20, choices=Type.choices)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.type}] {self.title} -> {self.user.email}'
