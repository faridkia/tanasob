"""
Send a single test SMS and explain, in plain language, whatever goes wrong.

Deliberately one recipient only: the reminder job fans out to every member
with a booking tomorrow, and the demo data is full of made-up phone numbers
that may well belong to real strangers. Use this to prove the SMS pipeline
works before trusting the bulk job.

    python manage.py send_test_sms 09XXXXXXXXX
"""

import logging

from django.conf import settings
from django.core.management.base import BaseCommand

from common.sms import send_sms


class Command(BaseCommand):
    help = 'Send one test SMS to a single number and report exactly what happened.'

    def add_arguments(self, parser):
        parser.add_argument('phone', help='Recipient, e.g. 09123456789')
        parser.add_argument(
            '--message',
            default='باشگاه تناسب | این یک پیام آزمایشی است. سامانه پیامک باشگاه فعال است.',
            help='Override the default test message.',
        )

    def handle(self, *args, **options):
        phone, message = options['phone'], options['message']

        # common.sms logs the provider's raw failure (which carries the real
        # reason, including your outbound IP on an allowlist rejection) at
        # WARNING and otherwise stays silent. Surface it here.
        logging.basicConfig(level=logging.INFO, format='%(message)s')

        self.stdout.write('--- configuration ---')
        key, line = settings.SMS_IR_API_KEY, settings.SMS_IR_LINE_NUMBER
        self.stdout.write(f'  SMS_IR_API_KEY     : {"set (%d chars)" % len(key) if key else "MISSING"}')
        self.stdout.write(f'  SMS_IR_LINE_NUMBER : {line or "MISSING"}')
        if not key or not line:
            self.stdout.write(self.style.ERROR(
                '\nSMS is not configured, so every send is a silent no-op.\n'
                'Set SMS_IR_API_KEY and SMS_IR_LINE_NUMBER in backend/.env.'
            ))
            return

        self.stdout.write(f'\nSending to {phone} ...')
        ok = send_sms(phone, message)

        if ok:
            self.stdout.write(self.style.SUCCESS(
                f'\nSent. Check {phone} — it should arrive within a few seconds.'
            ))
            return

        self.stdout.write(self.style.ERROR('\nNot sent. Read the provider error printed above.'))
        self.stdout.write(
            '\nMost common causes:\n'
            '  401 "محدود به آی‌پی‌های تعریف شده"\n'
            '      The key is IP-locked and this machine is not on the allowlist.\n'
            '      The error line above states the IP the provider saw — add exactly\n'
            '      that IP in the sms.ir panel (Developer > web-service key > IP\n'
            '      restriction), or remove the restriction.\n'
            '      Note: a home/mobile connection usually has a DYNAMIC IP, so it\n'
            '      will stop matching. For anything permanent, allowlist the server\n'
            '      you deploy to instead.\n'
            '  403 / insufficient credit\n'
            '      The account has no credit left.\n'
            '  Line number rejected\n'
            '      SMS_IR_LINE_NUMBER does not belong to this account.\n'
        )
