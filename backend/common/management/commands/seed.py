"""Populate the development database with realistic Persian demo data."""

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Member, Trainer, TrainerMemberAssignment
from bookings.models import Attendance, Booking
from classes.models import ClassSession, GymClass
from memberships.models import MembershipPlan, Payment, Subscription
from messaging.models import Message
from notifications.models import Notification
from organizations.models import Organization
from plans.models import DietPlan, DietPlanItem, Exercise, WorkoutDay, WorkoutPlan, WorkoutPlanItem
from progress.models import BodyProgress

User = get_user_model()


class Command(BaseCommand):
    help = 'Populate the development database with Persian demo data. Safe to run repeatedly.'

    def handle(self, *args, **options):
        with transaction.atomic():
            self.stdout.write('در حال ایجاد داده‌های نمونه تناسب...')
            org, _ = Organization.objects.get_or_create(
                slug='tanasob', defaults={'name': 'باشگاه تناسب'}
            )
            admin = self._create_admin(org)
            trainers = self._create_trainers(org)
            members = self._create_members(org)
            membership_plans = self._create_membership_plans(org)
            self._create_subscriptions(members, membership_plans)
            self._create_assignments(members, trainers)
            sessions = self._create_classes_and_sessions(org, trainers)
            self._create_bookings_and_attendance(members, sessions)
            self._create_training_and_diet_plans(members, trainers)
            self._create_progress_entries(members)
            self._create_messages_and_notifications(admin, members, trainers)

        self.stdout.write(self.style.SUCCESS('\n✅ داده‌های نمونه با موفقیت ایجاد شدند.'))
        self.stdout.write('\nحساب‌های آزمایشی:')
        self.stdout.write('  مدیر:  admin@tanasob.ir / admin123')
        self.stdout.write('  مربی:  parisa@tanasob.ir / trainer123')
        self.stdout.write('  مربی:  hossein@tanasob.ir / trainer123')
        self.stdout.write('  عضو:   ali.rezaei@tanasob.ir / member123')
        self.stdout.write('  عضو:   sara.karimi@tanasob.ir / member123')

    def _upsert_user(self, *, email, full_name, role, phone, password, organization):
        user, _ = User.objects.get_or_create(
            email=email,
            defaults={
                'full_name': full_name,
                'role': role,
                'phone': phone,
                'organization': organization,
            },
        )
        user.full_name = full_name
        user.role = role
        user.phone = phone
        user.organization = organization
        user.is_active = True
        user.set_password(password)
        user.save()
        return user

    def _create_admin(self, org):
        admin = self._upsert_user(
            email='admin@tanasob.ir',
            full_name='مدیر باشگاه تناسب',
            role=User.Role.ADMIN,
            phone='۰۲۱۴۴۰۰۰۰۰۰',
            password='admin123',
            organization=org,
        )
        admin.is_staff = True
        admin.is_superuser = True
        admin.save(update_fields=['is_staff', 'is_superuser'])
        return admin

    def _create_trainers(self, org):
        trainer_data = [
            {
                'email': 'parisa@tanasob.ir',
                'full_name': 'پریسا احمدی',
                'phone': '۰۹۱۲۱۱۱۱۱۱۱',
                'specialization': 'یوگا و پیلاتس',
                'bio': 'مربی یوگا و پیلاتس با تمرکز بر انعطاف‌پذیری و اصلاح فرم بدن.',
                'experience_years': 8,
            },
            {
                'email': 'hossein@tanasob.ir',
                'full_name': 'حسین محمدی',
                'phone': '۰۹۱۲۲۲۲۲۲۲۲',
                'specialization': 'بدنسازی و تمرینات قدرتی',
                'bio': 'مربی بدنسازی با برنامه‌های تخصصی افزایش قدرت و عضله‌سازی.',
                'experience_years': 11,
            },
            {
                'email': 'negin@tanasob.ir',
                'full_name': 'نگین رحیمی',
                'phone': '۰۹۱۲۳۳۳۳۳۳۳',
                'specialization': 'کراس‌فیت و تمرینات عملکردی',
                'bio': 'مربی تمرینات عملکردی برای بهبود استقامت، تعادل و آمادگی عمومی.',
                'experience_years': 6,
            },
        ]
        trainers = []
        for data in trainer_data:
            user = self._upsert_user(
                email=data['email'],
                full_name=data['full_name'],
                role=User.Role.TRAINER,
                phone=data['phone'],
                password='trainer123',
                organization=org,
            )
            trainer, _ = Trainer.objects.get_or_create(user=user)
            trainer.specialization = data['specialization']
            trainer.bio = data['bio']
            trainer.experience_years = data['experience_years']
            trainer.save()
            trainers.append(trainer)
        return trainers

    def _create_members(self, org):
        member_data = [
            ('علی رضایی', 'ali.rezaei@tanasob.ir', '۰۹۱۳۱۰۰۰۰۰۱', date(1998, 5, 21), 'مرد', 'تهران، پونک'),
            ('سارا کریمی', 'sara.karimi@tanasob.ir', '۰۹۱۳۱۰۰۰۰۰۲', date(1996, 9, 12), 'زن', 'تهران، صادقیه'),
            ('مهدی اکبری', 'mehdi.akbari@tanasob.ir', '۰۹۱۳۱۰۰۰۰۰۳', date(1992, 2, 4), 'مرد', 'تهران، ستارخان'),
            ('الهام موسوی', 'elham.mousavi@tanasob.ir', '۰۹۱۳۱۰۰۰۰۰۴', date(2000, 11, 16), 'زن', 'تهران، جنت‌آباد'),
            ('رضا نادری', 'reza.naderi@tanasob.ir', '۰۹۱۳۱۰۰۰۰۰۵', date(1989, 7, 9), 'مرد', 'تهران، نارمک'),
            ('نگار شریفی', 'negar.sharifi@tanasob.ir', '۰۹۱۳۱۰۰۰۰۰۶', date(1995, 4, 28), 'زن', 'تهران، تهرانپارس'),
            ('امیرحسین رستمی', 'amirhossein.rostami@tanasob.ir', '۰۹۱۳۱۰۰۰۰۰۷', date(1997, 1, 30), 'مرد', 'تهران، شهران'),
            ('مریم عباسی', 'maryam.abbasi@tanasob.ir', '۰۹۱۳۱۰۰۰۰۰۸', date(1993, 12, 6), 'زن', 'تهران، مرزداران'),
        ]
        members = []
        for full_name, email, phone, birth_date, gender, address in member_data:
            user = self._upsert_user(
                email=email,
                full_name=full_name,
                role=User.Role.MEMBER,
                phone=phone,
                password='member123',
                organization=org,
            )
            member, _ = Member.objects.get_or_create(user=user)
            member.date_of_birth = birth_date
            member.gender = gender
            member.address = address
            member.save()
            members.append(member)
        return members

    def _create_membership_plans(self, org):
        plan_data = [
            ('پلن یک‌ماهه', 30, Decimal('1590000'), 'دسترسی کامل به سالن و کلاس‌های گروهی برای یک ماه.'),
            ('پلن سه‌ماهه', 90, Decimal('4290000'), 'انتخاب اقتصادی برای سه ماه تمرین مستمر.'),
            ('پلن شش‌ماهه', 180, Decimal('7890000'), 'همراه با یک جلسه ارزیابی اولیه بدن.'),
            ('پلن سالانه', 365, Decimal('13990000'), 'بهترین انتخاب برای تمرین بلندمدت و پایدار.'),
        ]
        plans = []
        for name, duration_days, price, description in plan_data:
            plan, _ = MembershipPlan.objects.get_or_create(
                organization=org,
                name=name,
                defaults={
                    'duration_days': duration_days,
                    'price': price,
                    'description': description,
                    'is_active': True,
                },
            )
            plan.duration_days = duration_days
            plan.price = price
            plan.description = description
            plan.is_active = True
            plan.save()
            plans.append(plan)
        return plans

    def _create_subscriptions(self, members, plans):
        today = timezone.localdate()
        subscription_data = [
            (members[0], plans[2], today - timedelta(days=24), today + timedelta(days=156), Subscription.Status.ACTIVE),
            (members[1], plans[1], today - timedelta(days=18), today + timedelta(days=72), Subscription.Status.ACTIVE),
            (members[2], plans[0], today - timedelta(days=7), today + timedelta(days=23), Subscription.Status.ACTIVE),
            (members[3], plans[3], today - timedelta(days=90), today + timedelta(days=275), Subscription.Status.ACTIVE),
            (members[4], plans[1], today - timedelta(days=46), today + timedelta(days=44), Subscription.Status.ACTIVE),
            (members[5], plans[0], today - timedelta(days=65), today - timedelta(days=35), Subscription.Status.EXPIRED),
            (members[6], plans[1], today - timedelta(days=100), today - timedelta(days=10), Subscription.Status.EXPIRED),
            (members[7], plans[0], today - timedelta(days=4), today + timedelta(days=26), Subscription.Status.CANCELLED),
        ]
        for index, (member, plan, start_date, end_date, status) in enumerate(subscription_data, start=1):
            # Lookup is (member, plan) only — start_date/end_date are computed
            # relative to "today" and drift on every real-world day this
            # command re-runs, so including them in the lookup key caused
            # get_or_create to miss the existing row and insert a duplicate
            # ACTIVE subscription instead of updating it.
            subscription, _ = Subscription.objects.get_or_create(
                member=member,
                plan=plan,
                defaults={'start_date': start_date, 'end_date': end_date, 'status': status},
            )
            subscription.start_date = start_date
            subscription.end_date = end_date
            subscription.status = status
            subscription.save(update_fields=['start_date', 'end_date', 'status'])
            payment_status = (
                Payment.Status.SUCCESS
                if status != Subscription.Status.CANCELLED
                else Payment.Status.FAILED
            )
            Payment.objects.get_or_create(
                subscription=subscription,
                transaction_ref=f'SEED-PAY-{index:03}',
                defaults={
                    'amount': plan.price,
                    'status': payment_status,
                    'paid_at': timezone.now() - timedelta(days=index)
                    if payment_status == Payment.Status.SUCCESS
                    else None,
                },
            )

    def _create_assignments(self, members, trainers):
        assignments = [
            (members[0], trainers[1]),
            (members[1], trainers[0]),
            (members[2], trainers[1]),
            (members[3], trainers[0]),
            (members[4], trainers[2]),
            (members[5], trainers[0]),
            (members[6], trainers[1]),
            (members[7], trainers[2]),
        ]
        for member, trainer in assignments:
            assignment, _ = TrainerMemberAssignment.objects.get_or_create(
                member=member,
                trainer=trainer,
                defaults={'status': TrainerMemberAssignment.Status.ACTIVE},
            )
            if assignment.status != TrainerMemberAssignment.Status.ACTIVE:
                assignment.status = TrainerMemberAssignment.Status.ACTIVE
                assignment.save(update_fields=['status'])

    def _create_classes_and_sessions(self, org, trainers):
        class_data = [
            ('یوگا صبحگاهی', 'یوگا', 'کلاس آرام و انرژی‌بخش برای شروع روز با تمرکز بر تنفس و انعطاف.'),
            ('پیلاتس', 'اصلاحی', 'تقویت عضلات مرکزی و بهبود وضعیت بدن.'),
            ('بدنسازی مقدماتی', 'قدرتی', 'آشنایی اصولی با تمرین مقاومتی و فرم صحیح حرکات.'),
            ('کراس‌فیت', 'عملکردی', 'تمرین پرانرژی برای افزایش توان، استقامت و چابکی.'),
            ('TRX', 'قدرتی', 'تمرین کل بدن با بندهای تعلیقی و وزن بدن.'),
        ]
        gym_classes = {}
        for name, category, description in class_data:
            gym_class, _ = GymClass.objects.get_or_create(
                organization=org,
                name=name,
                defaults={'category': category, 'description': description},
            )
            gym_class.category = category
            gym_class.description = description
            gym_class.save()
            gym_classes[name] = gym_class

        today = timezone.localdate()
        session_data = [
            ('یوگا صبحگاهی', trainers[0], today + timedelta(days=1), time(8, 0), time(9, 0), 18),
            ('بدنسازی مقدماتی', trainers[1], today + timedelta(days=1), time(18, 0), time(19, 30), 16),
            ('کراس‌فیت', trainers[2], today + timedelta(days=2), time(17, 0), time(18, 0), 14),
            ('پیلاتس', trainers[0], today + timedelta(days=3), time(10, 0), time(11, 0), 15),
            ('TRX', trainers[2], today + timedelta(days=4), time(19, 0), time(20, 0), 12),
            ('بدنسازی مقدماتی', trainers[1], today + timedelta(days=5), time(9, 0), time(10, 30), 16),
            ('یوگا صبحگاهی', trainers[0], today - timedelta(days=6), time(8, 0), time(9, 0), 18),
            ('کراس‌فیت', trainers[2], today - timedelta(days=4), time(17, 0), time(18, 0), 14),
        ]
        sessions = []
        for class_name, trainer, session_date, start_time, end_time, capacity in session_data:
            session, _ = ClassSession.objects.get_or_create(
                gym_class=gym_classes[class_name],
                trainer=trainer,
                session_date=session_date,
                start_time=start_time,
                defaults={'end_time': end_time, 'capacity': capacity},
            )
            session.end_time = end_time
            session.capacity = capacity
            session.save()
            sessions.append(session)
        return sessions

    def _create_bookings_and_attendance(self, members, sessions):
        booking_data = [
            (members[0], sessions[0]),
            (members[1], sessions[0]),
            (members[2], sessions[1]),
            (members[3], sessions[2]),
            (members[4], sessions[3]),
            (members[0], sessions[4]),
            (members[1], sessions[5]),
            (members[0], sessions[6]),
            (members[3], sessions[6]),
            (members[4], sessions[7]),
        ]
        for member, session in booking_data:
            Booking.objects.get_or_create(
                member=member,
                session=session,
                defaults={'status': Booking.Status.CONFIRMED},
            )

        for member, session in ((members[0], sessions[6]), (members[3], sessions[6]), (members[4], sessions[7])):
            attendance, created = Attendance.objects.get_or_create(member=member, session=session)
            if created:
                check_in_time = timezone.make_aware(
                    datetime.combine(session.session_date, session.start_time)
                ) + timedelta(minutes=5)
                Attendance.objects.filter(pk=attendance.pk).update(check_in_time=check_in_time)

    def _create_training_and_diet_plans(self, members, trainers):
        plan_data = [
            (
                members[0],
                trainers[1],
                'برنامه افزایش حجم مقدماتی',
                [
                    ('اسکوات هالتر', 4, 10, 'استراحت ۹۰ ثانیه؛ تمرکز روی فرم صحیح.'),
                    ('پرس سینه دمبل', 4, 12, 'وزنه متوسط و کنترل کامل حرکت.'),
                    ('لت سیم‌کش', 3, 12, 'شانه‌ها را پایین نگه دارید.'),
                ],
                [
                    ('صبحانه', 520, 'تخم‌مرغ، نان سبوس‌دار، پنیر و گردو.'),
                    ('ناهار', 740, 'برنج، سینه مرغ گریل‌شده و سالاد فصل.'),
                    ('میان‌وعده', 320, 'ماست یونانی، موز و چند عدد بادام.'),
                ],
            ),
            (
                members[1],
                trainers[0],
                'برنامه انعطاف و فرم‌دهی',
                [
                    ('پل باسن', 3, 15, 'در بالای حرکت دو ثانیه مکث کنید.'),
                    ('پلانک', 3, 45, 'زمان هر ست بر حسب ثانیه است.'),
                    ('کشش همسترینگ', 3, 12, 'حرکت آرام و بدون فشار ناگهانی.'),
                ],
                [
                    ('صبحانه', 430, 'اوتمیل با شیر کم‌چرب، دارچین و میوه تازه.'),
                    ('ناهار', 610, 'خوراک عدس، سبزیجات بخارپز و نان سنگک.'),
                    ('شام', 450, 'سوپ جو و سالاد مرغ.'),
                ],
            ),
            (
                members[4],
                trainers[2],
                'برنامه آمادگی عملکردی',
                [
                    ('کتل‌بل سوئینگ', 4, 15, 'حرکت از مفصل لگن انجام شود.'),
                    ('برپی', 3, 12, 'سرعت یکنواخت و تنفس کنترل‌شده.'),
                    ('روئینگ دستگاه', 4, 500, 'هر ست ۵۰۰ متر با شدت متوسط.'),
                ],
                [
                    ('صبحانه', 500, 'املت سبزیجات، نان سبوس‌دار و یک پرتقال.'),
                    ('ناهار', 700, 'ماهی کبابی، سیب‌زمینی و سبزیجات.'),
                    ('پس از تمرین', 280, 'شیر، موز و کره بادام‌زمینی.'),
                ],
            ),
        ]
        today = timezone.localdate()
        for index, (member, trainer, title, exercises, meals) in enumerate(plan_data):
            workout_plan, _ = WorkoutPlan.objects.get_or_create(
                member=member,
                trainer=trainer,
                title=title,
                defaults={
                    'start_date': today - timedelta(days=14 - index),
                    'end_date': today + timedelta(days=42),
                },
            )
            day, _ = WorkoutDay.objects.get_or_create(
                workout_plan=workout_plan, day_number=1, defaults={'label': 'روز ۱'}
            )
            for exercise_name, sets, reps, notes in exercises:
                exercise, _ = Exercise.objects.get_or_create(
                    organization=None, name=exercise_name,
                    defaults={'muscle_group': Exercise.MuscleGroup.FULL_BODY},
                )
                WorkoutPlanItem.objects.get_or_create(
                    day=day,
                    exercise=exercise,
                    defaults={'sets': sets, 'reps': reps, 'notes': notes},
                )

            diet_plan, _ = DietPlan.objects.get_or_create(
                member=member,
                trainer=trainer,
                title=f'رژیم {title}',
                defaults={
                    'start_date': today - timedelta(days=14 - index),
                    'end_date': today + timedelta(days=42),
                },
            )
            for meal_name, calories, description in meals:
                DietPlanItem.objects.get_or_create(
                    diet_plan=diet_plan,
                    meal_name=meal_name,
                    defaults={'calories': calories, 'description': description},
                )

    def _create_progress_entries(self, members):
        today = timezone.localdate()
        progress_data = [
            (members[0], [('82.40', '22.10', '92.00'), ('81.30', '21.20', '90.50'), ('80.60', '20.40', '89.00')]),
            (members[1], [('64.20', '28.00', '76.00'), ('63.50', '27.10', '74.50'), ('62.90', '26.50', '73.00')]),
            (members[4], [('91.00', '25.30', '101.00'), ('89.70', '24.40', '99.00'), ('88.60', '23.80', '97.50')]),
        ]
        for member, measurements in progress_data:
            for offset, (weight, body_fat, waist) in enumerate(measurements):
                recorded_at = today - timedelta(days=42 - (offset * 21))
                BodyProgress.objects.get_or_create(
                    member=member,
                    recorded_at=recorded_at,
                    defaults={
                        'weight_kg': Decimal(weight),
                        'body_fat_percent': Decimal(body_fat),
                        'waist_cm': Decimal(waist),
                        'notes': 'روند پیشرفت رضایت‌بخش است؛ برنامه با همین کیفیت ادامه پیدا کند.',
                    },
                )

    def _create_messages_and_notifications(self, admin, members, trainers):
        messages = [
            (members[0].user, trainers[1].user, 'سلام مربی، برای حرکت اسکوات زانوهایم کمی درد می‌گیرد.'),
            (trainers[1].user, members[0].user, 'سلام علی، فعلاً وزنه را سبک‌تر کن و قبل از حرکت گرم‌کردن را جدی بگیر.'),
            (members[1].user, trainers[0].user, 'پریسا جان، تمرین‌های کششی این هفته خیلی خوب بود.'),
            (trainers[0].user, members[1].user, 'عالیه سارا! هفته بعد مدت پلانک را کمی بیشتر می‌کنیم.'),
        ]
        for sender, receiver, content in messages:
            Message.objects.get_or_create(
                sender=sender,
                receiver=receiver,
                content=content,
            )

        notification_data = [
            (admin, 'داده‌های نمونه آماده است', 'دیتای فارسی برای نمایش پروژه با موفقیت ایجاد شد.', Notification.Type.SUBSCRIPTION),
            (members[0].user, 'یادآوری کلاس', 'کلاس یوگا صبحگاهی شما فردا ساعت ۸ برگزار می‌شود.', Notification.Type.SESSION_REMINDER),
            (members[1].user, 'پیام جدید از پریسا احمدی', 'مربی شما به پیام اخیرتان پاسخ داده است.', Notification.Type.MESSAGE),
            (members[4].user, 'رزرو کلاس تأیید شد', 'رزرو شما برای کلاس پیلاتس ثبت شد.', Notification.Type.BOOKING),
        ]
        for user, title, message, notification_type in notification_data:
            Notification.objects.get_or_create(
                user=user,
                title=title,
                defaults={'message': message, 'type': notification_type},
            )
