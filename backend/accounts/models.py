import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        MEMBER = 'MEMBER', 'Member'
        TRAINER = 'TRAINER', 'Trainer'
        ADMIN = 'ADMIN', 'Admin'

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    # Which gym this account belongs to (row-level multi-tenancy). Nullable so
    # Django superusers created via createsuperuser (platform-level, /admin/
    # only) don't need to belong to any single gym.
    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='users',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)  # Django admin access

    # Public by default, with an opt-out — matches how members expect a gym
    # community to work. When off, other members see only the name and
    # avatar; the activity detail (classes attended, streaks, stats) is
    # hidden. Admins and the user themselves always see the full profile.
    is_profile_public = models.BooleanField(default=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    def __str__(self):
        return f'{self.full_name} ({self.email})'

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

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='member_profile'
    )
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Separate from is_profile_public on purpose: plenty of people are happy
    # to have a profile but don't want their name ranked against everyone
    # else's. Opting out hides them from the leaderboard entirely; their
    # own points page still works.
    show_on_leaderboard = models.BooleanField(default=True)

    qr_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    # 128-length face-api.js descriptor captured client-side at enrollment,
    # used for face-recognition check-in (see bookings.services.match_face).
    # Never a raw photo — just the numeric embedding.
    face_descriptor = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f'Member: {self.user.full_name}'


class Trainer(models.Model):

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='trainer_profile'
    )
    specialization = models.CharField(max_length=100, blank=True)
    bio = models.TextField(blank=True)
    # Rich version of `bio`, written in the WYSIWYG editor and allowed to
    # contain images. `bio` is kept as the plain-text short line used in
    # lists and cards; this one is only rendered on the trainer's own page.
    # Always sanitised via common.richtext before it is stored.
    bio_html = models.TextField(blank=True)
    photo = models.ImageField(upload_to='trainers/', null=True, blank=True)
    experience_years = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Trainer: {self.user.full_name}'


class TrainerMemberAssignment(models.Model):
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

    def clean(self):
        if self.member_id and self.trainer_id:
            if self.member.user.organization_id != self.trainer.user.organization_id:
                raise ValidationError('Member and trainer must belong to the same gym.')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
