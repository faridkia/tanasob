"""Send tomorrow's class-session reminders across every gym on the
platform — one in-app Notification plus a real SMS (if the member has a
phone number and SMS is configured) per confirmed booking. Meant to run
once a day via cron; safe to run more than once a day since it doesn't
dedupe against "already sent today", but it only ever looks at tomorrow's
sessions so a second run in the same day is harmless repetition rather
than a wrong reminder.
"""

from django.core.management.base import BaseCommand

from ...services_reminders import send_tomorrows_session_reminders


class Command(BaseCommand):
    help = "Send SMS + in-app reminders for tomorrow's confirmed class-session bookings (all gyms)."

    def handle(self, *args, **options):
        result = send_tomorrows_session_reminders()
        self.stdout.write(self.style.SUCCESS(
            f"✅ {result['notified']} یادآوری برای {result['date']} ارسال شد ({result['sms_sent']} پیامک واقعی)."
        ))
