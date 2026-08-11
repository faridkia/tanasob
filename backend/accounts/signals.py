"""
Signals for the accounts app.

Whenever a User is created, the matching specialized profile (Member or
Trainer) is created automatically based on the role. This keeps the 1:1
relationship between User and its profile consistent (SRS 6.1).
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Member, Trainer, User


@receiver(post_save, sender=User)
def create_profile_for_user(sender, instance, created, **kwargs):
    """Auto-create a Member or Trainer profile when a new User is created."""
    if not created:
        return

    if instance.role == User.Role.MEMBER and not hasattr(instance, 'member_profile'):
        Member.objects.create(user=instance)
    elif instance.role == User.Role.TRAINER and not hasattr(instance, 'trainer_profile'):
        Trainer.objects.create(user=instance)
