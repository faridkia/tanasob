"""Tomorrow's session reminders — shared by the ``send_session_reminders``
cron command and the admin's manual "send now" button, so the two can't
drift into different logic."""

from datetime import timedelta

from django.utils import timezone

from common.sms import send_sms
from notifications.models import Notification
from notifications.services import notify

from .models import Booking


def send_tomorrows_session_reminders(organization=None):
    """Notify (in-app + real SMS) every member with a CONFIRMED booking for
    tomorrow. Scoped to ``organization`` when given (the admin "send now"
    button only reaches its own gym); unscoped for the cron command, which
    covers every gym on the platform in one run.
    """
    tomorrow = timezone.localdate() + timedelta(days=1)
    bookings = Booking.objects.filter(
        status=Booking.Status.CONFIRMED,
        session__session_date=tomorrow,
    ).select_related('member__user', 'session__gym_class')
    if organization is not None:
        bookings = bookings.filter(member__user__organization=organization)

    notified = 0
    sms_sent = 0
    for booking in bookings:
        session = booking.session
        user = booking.member.user
        message = (
            f'یادآوری: فردا ساعت {session.start_time.strftime("%H:%M")} '
            f'کلاس «{session.gym_class.name}» داری. منتظرتیم!'
        )
        notify(user, title='یادآوری جلسه فردا', message=message, type_=Notification.Type.SESSION_REMINDER)
        notified += 1
        if user.phone and send_sms(user.phone, message):
            sms_sent += 1

    return {'date': tomorrow, 'notified': notified, 'sms_sent': sms_sent}
