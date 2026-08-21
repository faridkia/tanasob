"""Create the amin@tanasob.com demo admin account.

Separate from `seed` (which only creates one admin: admin@tanasob.ir) so a
reviewer can log in as a second, independently-named admin without touching
the primary one. Safe to run repeatedly.
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()

EMAIL = 'amin@tanasob.com'
PASSWORD = 'amin123'


class Command(BaseCommand):
    help = 'Create/update the amin@tanasob.com demo admin account. Safe to run repeatedly.'

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            email=EMAIL,
            defaults={'full_name': 'امین رضایی', 'role': User.Role.ADMIN, 'phone': '۰۹۱۲۸۸۸۸۸۸۸'},
        )
        user.full_name = 'امین رضایی'
        user.role = User.Role.ADMIN
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.set_password(PASSWORD)
        user.save()
        self.stdout.write(self.style.SUCCESS(
            f'\n✅ {"ساخته شد" if created else "به‌روزرسانی شد"}: {EMAIL} / {PASSWORD}'
        ))
