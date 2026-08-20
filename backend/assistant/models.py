"""Model for the assistant app: chat history with the AI assistant.

Each user (member, trainer, or admin) has one running conversation; messages
are stored so the assistant can see prior turns and so the chat UI can
reload history after a page refresh.
"""

from django.conf import settings
from django.db import models


class ChatMessage(models.Model):
    class Role(models.TextChoices):
        USER = 'USER', 'User'
        ASSISTANT = 'ASSISTANT', 'Assistant'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ai_messages'
    )
    role = models.CharField(max_length=10, choices=Role.choices)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.user.email} [{self.role}] {self.content[:40]}'
