"""
Booking service layer.

Encapsulates the booking business rules (active subscription, capacity,
duplicate prevention) so views stay thin and the rules can be reused/tested
in isolation (NFR-5, NFR-6).
"""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from memberships.services import has_active_subscription

from notifications.models import Notification
from notifications.services import notify


@transaction.atomic
def create_booking(member, session):
    """Create a CONFIRMED booking for ``member`` on ``session``.

    Enforces: FR-BOOK-1 (active subscription), FR-BOOK-2 (capacity),
    FR-BOOK-4 (no duplicate). Emits a confirmation notification (FR-BOOK-5).
    """
    if not has_active_subscription(member):
        raise ValidationError('An active subscription is required to book a session (FR-MEM-7).')

    if member.bookings.filter(session=session, status='CONFIRMED').exists():
        raise ValidationError('You have already booked this session.')

    # Re-check capacity inside the transaction to avoid races.
    if session.is_full:
        raise ValidationError('This session has reached its maximum capacity.')

    booking = member.bookings.create(session=session, status='CONFIRMED')
    notify(
        member.user,
        title='Booking confirmed',
        message=f'Your booking for "{session.gym_class.name}" on '
        f'{session.session_date} at {session.start_time} is confirmed.',
        type_=Notification.Type.BOOKING,
    )
    return booking


def cancel_booking(booking):
    """Cancel a booking if the session hasn't started yet (FR-BOOK-3)."""
    now = timezone.now()
    session_start = timezone.make_aware(
        timezone.datetime.combine(booking.session.session_date, booking.session.start_time)
    )
    if now >= session_start:
        raise ValidationError('Cannot cancel a booking after the session has started.')
    booking.status = 'CANCELLED'
    booking.save(update_fields=['status'])
    notify(
        booking.member.user,
        title='Booking cancelled',
        message=f'Your booking for "{booking.session.gym_class.name}" was cancelled.',
        type_=Notification.Type.BOOKING,
    )
    return booking
