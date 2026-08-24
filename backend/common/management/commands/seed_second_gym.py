"""Create a second, fully independent gym on the platform.

This is the multi-tenancy proof: log in as the first gym's admin (from
`seed`) and you see only its classes/members/reports; log in as this gym's
admin and everything is completely different data. Safe to run repeatedly.
"""

from datetime import time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Member, Trainer, TrainerMemberAssignment
from classes.models import ClassSession, GymClass
from memberships.models import MembershipPlan
from organizations.models import Organization

User = get_user_model()

ORG_NAME = 'باشگاه پرتو'
ORG_SLUG = 'porto'


class Command(BaseCommand):
    help = 'Create a second, independent demo gym (باشگاه پرتو) to prove tenant isolation. Safe to run repeatedly.'

    def handle(self, *args, **options):
        with transaction.atomic():
            org, _ = Organization.objects.get_or_create(
                slug=ORG_SLUG,
                defaults={'name': ORG_NAME, 'address': 'اصفهان، خیابان چهارباغ', 'phone': '۰۳۱۳۲۰۰۰۰۰۰'},
            )

            admin = self._upsert_user(
                email='admin@porto.tanasob.com', full_name='مدیر باشگاه پرتو',
                role=User.Role.ADMIN, phone='۰۹۱۴۱۰۰۰۰۰۱', password='porto123', organization=org,
            )
            admin.is_staff = True
            admin.save(update_fields=['is_staff'])

            trainer_user = self._upsert_user(
                email='trainer@porto.tanasob.com', full_name='کیانا مرادی',
                role=User.Role.TRAINER, phone='۰۹۱۴۱۰۰۰۰۰۲', password='porto123', organization=org,
            )
            trainer, _ = Trainer.objects.get_or_create(user=trainer_user)
            trainer.specialization = 'بدنسازی بانوان'
            trainer.bio = 'مربی بدنسازی و تناسب اندام بانوان.'
            trainer.experience_years = 5
            trainer.save()

            member_user = self._upsert_user(
                email='member@porto.tanasob.com', full_name='هستی جعفری',
                role=User.Role.MEMBER, phone='۰۹۱۴۱۰۰۰۰۰۳', password='porto123', organization=org,
            )
            member, _ = Member.objects.get_or_create(user=member_user)
            member.gender = 'زن'
            member.address = 'اصفهان، خیابان آپادانا'
            member.save()

            TrainerMemberAssignment.objects.get_or_create(
                member=member, trainer=trainer,
                defaults={'status': TrainerMemberAssignment.Status.ACTIVE},
            )

            plan, _ = MembershipPlan.objects.get_or_create(
                organization=org, name='پلن یک‌ماهه پرتو',
                defaults={
                    'duration_days': 30, 'price': Decimal('1290000'),
                    'description': 'دسترسی به سالن بدنسازی و کلاس‌های گروهی.', 'is_active': True,
                },
            )

            gym_class, _ = GymClass.objects.get_or_create(
                organization=org, name='بدنسازی بانوان',
                defaults={'category': 'قدرتی', 'description': 'کلاس بدنسازی مخصوص بانوان.'},
            )
            ClassSession.objects.get_or_create(
                gym_class=gym_class, trainer=trainer,
                session_date=timezone.localdate() + timedelta(days=1),
                start_time=time(17, 0),
                defaults={'end_time': time(18, 0), 'capacity': 12},
            )

        self.stdout.write(self.style.SUCCESS(f'\n✅ باشگاه دوم ({ORG_NAME}) آماده شد.'))
        self.stdout.write('\nحساب‌های آزمایشی باشگاه پرتو:')
        self.stdout.write('  مدیر:  admin@porto.tanasob.com / porto123')
        self.stdout.write('  مربی:  trainer@porto.tanasob.com / porto123')
        self.stdout.write('  عضو:   member@porto.tanasob.com / porto123')

    def _upsert_user(self, *, email, full_name, role, phone, password, organization):
        user, _ = User.objects.get_or_create(
            email=email,
            defaults={'full_name': full_name, 'role': role, 'phone': phone, 'organization': organization},
        )
        user.full_name = full_name
        user.role = role
        user.phone = phone
        user.organization = organization
        user.is_active = True
        user.set_password(password)
        user.save()
        return user
