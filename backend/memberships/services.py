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
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import LeaderboardReward, Payment, Subscription


def _generate_transaction_ref():
    return 'MOCK-' + uuid.uuid4().hex[:12].upper()


def _best_unredeemed_reward(member):
    return LeaderboardReward.objects.filter(member=member, is_redeemed=False).order_by('-percent').first()


def discount_for(member):
    """The single best discount this member gets, and why.

    Returns ``(percent, source, reward_or_none)``.

    Deliberately NOT a sum. A diamond member who also won last month would
    otherwise stack 15% + 15% into 30% off an annual plan, which is more
    than the gym can afford to give away. Taking the best one keeps every
    reward meaningful while capping the worst case at 15%.
    """
    from progress.gamification import tier_discount_for

    options = []

    tier_pct = tier_discount_for(member)
    if tier_pct:
        options.append((tier_pct, 'tier', None))

    reward = _best_unredeemed_reward(member)
    if reward:
        options.append((reward.percent, 'reward', reward))

    # Standing discount from having placed before, even once the headline
    # prize has been spent.
    residual = (
        LeaderboardReward.objects.filter(member=member, is_redeemed=True)
        .order_by('-residual_percent').first()
    )
    if residual and residual.residual_percent:
        options.append((residual.residual_percent, 'residual', None))

    if not options:
        return 0, None, None
    return max(options, key=lambda o: o[0])


@transaction.atomic
def purchase_subscription(member, plan):
    """Process a mock payment and create/renew a subscription (FR-MEM-2..FR-MEM-5).

    If the member has an unredeemed leaderboard reward, its discount is
    applied to the price automatically and the reward is consumed.

    Returns ``(subscription, payment)``. Raises ``ValueError`` if the member
    already has an active subscription (renew handled at expiry instead).
    """
    if has_active_subscription(member):
        raise ValueError('Member already has an active subscription.')

    percent, source, reward = discount_for(member)
    price = plan.price
    if percent:
        price = (price * (Decimal(100 - percent) / Decimal(100))).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )

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
        amount=price,
        status=Payment.Status.SUCCESS if success else Payment.Status.FAILED,
        transaction_ref=_generate_transaction_ref(),
        paid_at=timezone.now() if success else None,
    )

    # Only the one-time prize gets consumed. A tier or residual discount is
    # a standing benefit and must survive the purchase.
    if success and source == 'reward' and reward:
        reward.is_redeemed = True
        reward.redeemed_at = timezone.now()
        reward.save(update_fields=['is_redeemed', 'redeemed_at'])

    if not success:
        raise ValueError('Mock payment failed. Please try again.')

    return subscription, payment


def cancel_subscription(subscription):
    """Cancel a member's own active subscription (mirrors bookings' cancel flow)."""
    if subscription.status != Subscription.Status.ACTIVE:
        raise ValueError('Only an active subscription can be cancelled.')
    subscription.status = Subscription.Status.CANCELLED
    subscription.save(update_fields=['status'])
    return subscription


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
