"""
Service layer for the memberships app.

Keeps the mock-payment and subscription logic out of views/serializers
(NFR-6: layered architecture) and lets other apps (e.g. bookings) reuse the
"does this member have an active subscription?" check (FR-MEM-7).
"""

import random
import string
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Payment, Subscription


def _generate_transaction_ref():
    return 'MOCK-' + uuid.uuid4().hex[:12].upper()


@transaction.atomic
def purchase_subscription(member, plan):
    """Process a mock payment and create/renew a subscription (FR-MEM-2..FR-MEM-5).

    Returns ``(subscription, payment)``. Raises ``ValueError`` if the member
    already has an active subscription (renew handled at expiry instead).
    """
    if has_active_subscription(member):
        raise ValueError('Member already has an active subscription.')

    # Simulate a payment gateway (FR-MEM-3). The failure rate is configurable.
    failure_rate = float(getattr(settings, 'MOCK_PAYMENT_FAILURE_RATE', 0.0))
    success = random.random() >= failure_rate

    today = timezone.now().date()
    start_date = today
    end_date = today + timedelta(days=plan.duration_days)

    subscription = Subscription.objects.create(
        member=member,
        plan=plan,
        start_date=start_date,
        end_date=end_date,
        status=Subscription.Status.ACTIVE if success else Subscription.Status.CANCELLED,
    )

    payment = Payment.objects.create(
        subscription=subscription,
        amount=plan.price,
        status=Payment.Status.SUCCESS if success else Payment.Status.FAILED,
        transaction_ref=_generate_transaction_ref(),
        paid_at=timezone.now() if success else None,
    )

    if not success:
        raise ValueError('Mock payment failed. Please try again.')

    return subscription, payment


def has_active_subscription(member) -> bool:
    """Return True if ``member`` currently has an ACTIVE subscription (FR-MEM-7)."""
    return Subscription.objects.filter(
        member=member,
        status=Subscription.Status.ACTIVE,
        end_date__gte=timezone.now().date(),
    ).exists()


def get_active_subscription(member):
    """Return the member's active subscription or None."""
    return (
        Subscription.objects.filter(
            member=member,
            status=Subscription.Status.ACTIVE,
            end_date__gte=timezone.now().date(),
        )
        .order_by('-end_date')
        .first()
    )


def expire_due_subscriptions():
    """Mark all subscriptions past their end date as EXPIRED (FR-MEM-6).

    Intended to be called from a management command (seed/runserver hook) or
    a periodic task. Safe to call repeatedly.
    """
    today = timezone.now().date()
    qs = Subscription.objects.filter(
        status=Subscription.Status.ACTIVE, end_date__lt=today
    )
    count = qs.update(status=Subscription.Status.EXPIRED)
    return count
