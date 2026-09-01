"""
Models for the memberships app: membership plans, member subscriptions and
simulated payments.

Mapping to the SRS data model: MembershipPlan (6.5), Subscription (6.6),
Payment (6.7).
"""

from django.conf import settings
from django.db import models
from django.utils import timezone


class MembershipPlan(models.Model):
    """A subscription package offered by the gym (SRS 6.5)."""

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE, related_name='membership_plans',
    )
    name = models.CharField(max_length=100)
    duration_days = models.PositiveIntegerField(help_text='Length of the plan in days.')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['price']
        unique_together = ('organization', 'name')

    def __str__(self):
        return f'{self.name} ({self.duration_days}d)'


class Subscription(models.Model):
    """A member's purchased membership period (SRS 6.6)."""

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        EXPIRED = 'EXPIRED', 'Expired'
        CANCELLED = 'CANCELLED', 'Cancelled'

    member = models.ForeignKey(
        'accounts.Member', on_delete=models.CASCADE, related_name='subscriptions'
    )
    plan = models.ForeignKey(
        MembershipPlan, on_delete=models.PROTECT, related_name='subscriptions'
    )
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.member.user.email} - {self.plan.name} ({self.status})'

    def refresh_status(self):
        """Mark the subscription EXPIRED once its end date has passed (FR-MEM-6)."""
        if self.status == self.Status.ACTIVE and timezone.now().date() > self.end_date:
            self.status = self.Status.EXPIRED
            self.save(update_fields=['status'])
        return self.status

    @property
    def is_currently_active(self):
        return self.refresh_status() == self.Status.ACTIVE


class Payment(models.Model):
    """Simulated payment transaction for a subscription (SRS 6.7)."""

    class Method(models.TextChoices):
        MOCK_GATEWAY = 'MOCK_GATEWAY', 'Mock gateway'

    class Status(models.TextChoices):
        SUCCESS = 'SUCCESS', 'Success'
        FAILED = 'FAILED', 'Failed'
        PENDING = 'PENDING', 'Pending'

    subscription = models.ForeignKey(
        Subscription, on_delete=models.CASCADE, related_name='payments'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.MOCK_GATEWAY)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    transaction_ref = models.CharField(max_length=100, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Payment {self.transaction_ref} - {self.amount} ({self.status})'


class LeaderboardReward(models.Model):
    """A membership-plan discount earned by finishing top-3 for a period.

    Two numbers, on purpose:

    * ``percent`` — the headline prize, applied ONCE to the next purchase.
    * ``residual_percent`` — a small standing discount the member keeps
      afterwards.

    Winning one month shouldn't discount every annual renewal forever, but
    it also shouldn't evaporate the moment it's spent. So first place is
    15% once and 3% thereafter, second 10%/2%, third 5%/1%.
    """

    member = models.ForeignKey(
        'accounts.Member', on_delete=models.CASCADE, related_name='leaderboard_rewards'
    )
    rank = models.PositiveIntegerField(help_text='1, 2 or 3 — leaderboard position at grant time.')
    percent = models.PositiveIntegerField(help_text='One-time discount on the next plan purchase.')
    residual_percent = models.PositiveIntegerField(default=0, help_text='Standing discount kept after the one-time prize is spent.')
    is_redeemed = models.BooleanField(default=False)
    granted_at = models.DateTimeField(auto_now_add=True)
    redeemed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-granted_at']

    def __str__(self):
        return f'{self.member.user.full_name} - #{self.rank} ({self.percent}%)'
