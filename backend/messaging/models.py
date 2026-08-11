"""
Messaging model — chat messages between a member and their trainer (SRS 6.17).
"""

from django.conf import settings
from django.db import models


class Message(models.Model):
    """A single chat message between a Member and a Trainer (SRS 6.17)."""

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages',
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_messages',
    )
    content = models.TextField()
    sent_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['sent_at']

    def __str__(self):
        return f'{self.sender.email} -> {self.receiver.email}: {self.content[:30]}'
