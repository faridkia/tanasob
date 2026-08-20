"""
Models for the accounts app: the custom ``User`` plus the specialized
profiles (``Member``, ``Trainer``) and the many-to-many junction
``TrainerMemberAssignment``.

Mapping to the SRS data model (section 6): User (6.1), Member (6.2),
Trainer (6.3), TrainerMemberAssignment (6.4).
"""

import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """Base identity shared by all account types (SRS 6.1).

    The ``role`` field determines which specialized profile (Member/Trainer)
    is linked. Admins have no separate profile table.
    """

    class Role(models.TextChoices):
        MEMBER = 'MEMBER', 'Member'
        TRAINER = 'TRAINER', 'Trainer'
        ADMIN = 'ADMIN', 'Admin'

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)  # Django admin access

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    def __str__(self):
        return f'{self.full_name} ({self.email})'

    # --- Role helpers used by permissions across the project ---
    @property
    def is_member(self):
        return self.role == self.Role.MEMBER

    @property
    def is_trainer(self):
        return self.role == self.Role.TRAINER

    @property
    def is_admin_role(self):
        return self.role == self.Role.ADMIN


class Member(models.Model):
    """Profile data specific to gym members (SRS 6.2)."""

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='member_profile'
    )
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Unguessable identifier encoded in the member's QR check-in card; kept
    # separate from the primary key so the printed/displayed code can't be
    # used to enumerate other members.
    qr_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    def __str__(self):
        return f'Member: {self.user.full_name}'


class Trainer(models.Model):
    """Profile data specific to gym trainers/coaches (SRS 6.3)."""

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='trainer_profile'
    )
    specialization = models.CharField(max_length=100, blank=True)
    bio = models.TextField(blank=True)
    experience_years = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Trainer: {self.user.full_name}'


class TrainerMemberAssignment(models.Model):
    """Resolves the many-to-many relationship between Members and Trainers (SRS 6.4).

    A member may have several trainers and a trainer may have several members.
    """

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        ENDED = 'ENDED', 'Ended'

    member = models.ForeignKey(
        Member, on_delete=models.CASCADE, related_name='assignments'
    )
    trainer = models.ForeignKey(
        Trainer, on_delete=models.CASCADE, related_name='assignments'
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('member', 'trainer')
        ordering = ['-assigned_at']

    def __str__(self):
        return f'{self.trainer.user.full_name} -> {self.member.user.full_name} ({self.status})'
