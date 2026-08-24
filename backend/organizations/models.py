"""
Models for the organizations app: each row is an independent gym ("tenant")
running on the shared Tanasob platform.

Multi-tenancy strategy: single database, shared schema, row-level isolation.
``User``, ``GymClass`` and ``MembershipPlan`` carry a direct ``organization``
FK; everything else is scoped transitively through those (see
accounts.models.TrainerMemberAssignment.clean for the enforcement point).
"""

from django.db import models


class Organization(models.Model):
    """A single gym running on the platform."""

    name = models.CharField(max_length=150, unique=True)
    slug = models.SlugField(unique=True)
    logo = models.ImageField(upload_to='org_logos/', null=True, blank=True)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
