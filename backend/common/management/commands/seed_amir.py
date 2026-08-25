"""Populate a single, fully-fleshed-out demo member: amir@tanasob.com.

Reuses the trainers/classes/sessions/plans created by `seed` so the
professor has one account where every section of the app already has data —
active subscription, upcoming + past (attended) bookings, a workout plan, a
diet plan, body progress history, messages and notifications.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import Member, Trainer, TrainerMemberAssignment
from bookings.models import Attendance, Booking
from classes.models import ClassSession
from memberships.models import MembershipPlan, Payment, Subscription
from messaging.models import Message
from notifications.models import Notification
from plans.models import DietPlan, DietPlanItem, Exercise, WorkoutDay, WorkoutPlan, WorkoutPlanItem
from progress.models import BodyProgress

User = get_user_model()

EMAIL = 'amir@tanasob.com'
PASSWORD = 'amir123'


class Command(BaseCommand):
    help = (
        'Create/populate the amir@tanasob.com demo member with data across '
        'every app section. Run `seed` first. Safe to run repeatedly.'
    )

    def handle(self, *args, **options):
        # This DB also carries old English placeholder rows from earlier
        # manual testing (e.g. "Ali Trainer" / "Annual") — prefer the
        # Persian `seed` data so the demo account looks consistent, but
        # still fall back to whatever exists so this works standalone too.
        trainer = (
            Trainer.objects.select_related('user').filter(user__email='parisa@tanasob.ir').first()
            or Trainer.objects.select_related('user').first()
        )
        plan = (
            MembershipPlan.objects.filter(is_active=True, name__startswith='پلن')
            .order_by('-duration_days').first()
            or MembershipPlan.objects.filter(is_active=True).order_by('-duration_days').first()
        )
        sessions = list(ClassSession.objects.order_by('session_date')[:10])
        if not (trainer and plan and sessions):
            raise CommandError('اول «python manage.py seed» را اجرا کن تا مربی/پلن/جلسه نمونه وجود داشته باشد.')

        with transaction.atomic():
            member = self._create_member(trainer.user.organization)
            self._create_assignment(member, trainer)
            self._create_subscription(member, plan)
            self._create_bookings(member, sessions)
            self._create_workout_and_diet(member, trainer)
            self._create_progress(member)
            self._create_messages_and_notifications(member, trainer)

        self.stdout.write(self.style.SUCCESS(f'\n✅ داده‌های امیر آماده شد: {EMAIL} / {PASSWORD}'))

    def _create_member(self, organization):
        user, _ = User.objects.get_or_create(
            email=EMAIL,
            defaults={
                'full_name': 'امیر حسینی', 'role': User.Role.MEMBER, 'phone': '۰۹۱۲۹۹۹۹۹۹۹',
                'organization': organization,
            },
        )
        user.full_name = 'امیر حسینی'
        user.role = User.Role.MEMBER
        user.organization = organization
        user.is_active = True
        user.set_password(PASSWORD)
        user.save()
        member, _ = Member.objects.get_or_create(user=user)
        member.date_of_birth = date(1994, 3, 15)
        member.gender = 'مرد'
        member.address = 'تهران، ونک'
        member.save()
        return member

    def _create_assignment(self, member, trainer):
        assignment, _ = TrainerMemberAssignment.objects.get_or_create(
            member=member, trainer=trainer, defaults={'status': TrainerMemberAssignment.Status.ACTIVE},
        )
        if assignment.status != TrainerMemberAssignment.Status.ACTIVE:
            assignment.status = TrainerMemberAssignment.Status.ACTIVE
            assignment.save(update_fields=['status'])

    def _create_subscription(self, member, plan):
        # A member should only ever have one ACTIVE subscription at a time
        # (see memberships.services.purchase_subscription) — reuse an
        # existing one rather than risk creating a second, since this DB
        # may already carry an active subscription for this account.
        today = timezone.localdate()
        subscription = Subscription.objects.filter(member=member, status=Subscription.Status.ACTIVE).first()
        if subscription is None:
            subscription = Subscription.objects.create(
                member=member, plan=plan,
                start_date=today - timedelta(days=10),
                end_date=today + timedelta(days=plan.duration_days - 10),
                status=Subscription.Status.ACTIVE,
            )
        elif not subscription.plan.name.startswith('پلن'):
            # Swap a leftover English placeholder plan for the demo's own,
            # so the account doesn't read as half-broken in the UI.
            subscription.plan = plan
            subscription.end_date = today + timedelta(days=plan.duration_days - 10)
            subscription.save(update_fields=['plan', 'end_date'])
        Payment.objects.get_or_create(
            subscription=subscription,
            transaction_ref='SEED-AMIR-PAY-001',
            defaults={
                'amount': plan.price,
                'status': Payment.Status.SUCCESS,
                'paid_at': timezone.now() - timedelta(days=10),
            },
        )
        return subscription

    def _create_bookings(self, member, sessions):
        # `sessions` may be entirely in the past if `seed`'s relative dates
        # have drifted since it last ran — query upcoming/past directly
        # instead of slicing the (possibly all-past) list handed in.
        today = timezone.localdate()
        upcoming = list(ClassSession.objects.filter(session_date__gte=today).order_by('session_date')[:2])
        past = list(ClassSession.objects.filter(session_date__lt=today).order_by('-session_date')[:1]) or sessions[:1]
        for session in upcoming + past:
            Booking.objects.get_or_create(
                member=member, session=session, defaults={'status': Booking.Status.CONFIRMED}
            )
        for session in past:
            Attendance.objects.get_or_create(member=member, session=session)

    def _create_workout_and_diet(self, member, trainer):
        today = timezone.localdate()
        workout_plan, _ = WorkoutPlan.objects.get_or_create(
            member=member, trainer=trainer, title='برنامه کامل امیر',
            defaults={'start_date': today - timedelta(days=7), 'end_date': today + timedelta(days=56)},
        )
        day_plan = [
            (today, 'روز پا و سرشانه', [
                ('اسکوات هالتر', Exercise.MuscleGroup.LEGS, 'https://www.youtube.com/watch?v=Dy28eq2PjcM', 4, 8, 'استراحت ۹۰ ثانیه بین ست‌ها.'),
                ('پرس سرشانه', Exercise.MuscleGroup.SHOULDERS, 'https://www.youtube.com/watch?v=qEwKCR5JCog', 4, 10, 'کنترل کامل در فاز پایین‌رونده.'),
                ('لانج دمبل', Exercise.MuscleGroup.LEGS, '', 3, 12, 'هر پا جداگانه شمرده شود.'),
            ]),
            (today + timedelta(days=2), 'روز سینه و پشت بازو', [
                ('پرس سینه هالتر', Exercise.MuscleGroup.CHEST, 'https://www.youtube.com/watch?v=rT7DgCr-3pg', 4, 8, 'کتف‌ها را ثابت نگه دار.'),
                ('پشت بازو سیم‌کش', Exercise.MuscleGroup.ARMS, '', 3, 12, 'آرنج نزدیک بدن بماند.'),
            ]),
            (today + timedelta(days=4), 'روز پشت و دلتوئید', [
                ('ددلیفت', Exercise.MuscleGroup.BACK, 'https://www.youtube.com/watch?v=1ZXobu7JvvE', 3, 6, 'فرم صحیح مهم‌تر از وزنه است.'),
                ('لت سیم‌کش', Exercise.MuscleGroup.BACK, '', 4, 10, 'شانه‌ها را پایین نگه دار.'),
            ]),
        ]
        for date, label, exercises in day_plan:
            day, _ = WorkoutDay.objects.get_or_create(
                workout_plan=workout_plan, date=date, defaults={'label': label}
            )
            for exercise_name, muscle_group, video_url, sets, reps, notes in exercises:
                exercise, _ = Exercise.objects.get_or_create(
                    organization=None, name=exercise_name,
                    defaults={'muscle_group': muscle_group, 'video_url': video_url},
                )
                # This exercise may already exist as a bare legacy row from
                # the pre-library data migration — fill in the richer demo
                # data (muscle group, tutorial link) either way.
                if exercise.muscle_group != muscle_group or (video_url and exercise.video_url != video_url):
                    exercise.muscle_group = muscle_group
                    exercise.video_url = video_url or exercise.video_url
                    exercise.save(update_fields=['muscle_group', 'video_url'])
                WorkoutPlanItem.objects.get_or_create(
                    day=day, exercise=exercise,
                    defaults={'sets': sets, 'reps': reps, 'notes': notes},
                )

        diet_plan, _ = DietPlan.objects.get_or_create(
            member=member, trainer=trainer, title='رژیم کامل امیر',
            defaults={'start_date': today - timedelta(days=7), 'end_date': today + timedelta(days=56)},
        )
        for meal_name, calories, description in [
            ('صبحانه', 480, 'تخم‌مرغ آب‌پز، نان سبوس‌دار و آووکادو.'),
            ('میان‌وعده صبح', 220, 'یک عدد سیب و چند عدد بادام.'),
            ('ناهار', 780, 'سینه مرغ گریل‌شده، برنج قهوه‌ای و سالاد.'),
            ('میان‌وعده عصر', 300, 'ماست یونانی با عسل و گردو.'),
            ('شام', 520, 'ماهی سالمون، سیب‌زمینی شیرین و بروکلی بخارپز.'),
        ]:
            DietPlanItem.objects.get_or_create(
                diet_plan=diet_plan, meal_name=meal_name,
                defaults={'calories': calories, 'description': description},
            )

    def _create_progress(self, member):
        today = timezone.localdate()
        for offset, (weight, body_fat, waist) in enumerate([
            ('88.50', '24.00', '96.00'),
            ('86.90', '22.60', '93.50'),
            ('85.40', '21.30', '91.00'),
        ]):
            recorded_at = today - timedelta(days=42 - offset * 21)
            # BodyProgress has no unique constraint on (member, recorded_at) —
            # a member can legitimately log more than one entry a day — so
            # get_or_create can't be used here; skip instead of duplicating
            # if this demo entry already exists.
            if BodyProgress.objects.filter(member=member, recorded_at=recorded_at).exists():
                continue
            BodyProgress.objects.create(
                member=member, recorded_at=recorded_at,
                weight_kg=Decimal(weight), body_fat_percent=Decimal(body_fat), waist_cm=Decimal(waist),
                notes='روند کاهش وزن طبق برنامه پیش می‌رود.',
            )

    def _create_messages_and_notifications(self, member, trainer):
        for sender, receiver, content in [
            (member.user, trainer.user, 'سلام مربی، برنامه هفته جدید رو دیدم، عالیه!'),
            (trainer.user, member.user, 'سلام امیر، خوشحالم که راضی هستی. هفته بعد وزنه‌ها رو کمی بالا می‌بریم.'),
        ]:
            if not Message.objects.filter(sender=sender, receiver=receiver, content=content).exists():
                Message.objects.create(sender=sender, receiver=receiver, content=content)

        for title, message, notif_type in [
            ('اشتراک شما فعال شد', 'اشتراک شما با موفقیت فعال شد.', Notification.Type.SUBSCRIPTION),
            ('پیام جدید از مربی', 'مربی شما به پیام اخیرتان پاسخ داده است.', Notification.Type.MESSAGE),
            ('یادآوری کلاس', 'یکی از کلاس‌های رزرو شده شما به‌زودی برگزار می‌شود.', Notification.Type.SESSION_REMINDER),
        ]:
            Notification.objects.get_or_create(
                user=member.user, title=title, defaults={'message': message, 'type': notif_type}
            )
