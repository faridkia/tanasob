"""
Helper to create notifications from anywhere in the project (FR-NOTIF-1..3).

Centralizing this keeps the notification shape consistent and avoids spreading
Notification imports across every app.
"""

from .models import Notification


def notify(user, title, message, type_=Notification.Type.BOOKING):
    """Create an in-app notification for ``user``. Safe to call with None user."""
    if user is None:
        return None
    return Notification.objects.create(
        user=user, title=title, message=message, type=type_
    )
