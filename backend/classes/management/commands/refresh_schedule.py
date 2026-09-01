"""
Roll the demo class schedule forward so the app always has upcoming sessions.

The seeded timetable is written with fixed dates, so it silently expires:
once today passes the last seeded session, members see an empty class list,
an empty calendar and nothing to book — the app looks broken when it isn't.
Run this before a demo (or from cron) to top the schedule back up.

    python manage.py refresh_schedule --weeks 3
"""

from datetime import timedelta

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand
from django.utils import timezone

from classes.models import ClassSession


class Command(BaseCommand):
    help = 'Generate upcoming class sessions from the existing weekly pattern.'

    def add_arguments(self, parser):
        parser.add_argument('--weeks', type=int, default=3, help='How many weeks ahead to fill (default 3).')

    def handle(self, *args, **options):
        weeks = options['weeks']
        today = timezone.localdate()
        horizon = today + timedelta(weeks=weeks)

        # Reuse the shape of the existing timetable — same class, trainer,
        # time and capacity, on the same weekday — rather than inventing a
        # new one, so the demo keeps its character.
        patterns = {}
        for s in ClassSession.objects.select_related('gym_class', 'trainer'):
            key = (s.gym_class_id, s.trainer_id, s.start_time, s.end_time, s.session_date.weekday())
            patterns.setdefault(key, s.capacity)

        if not patterns:
            self.stdout.write(self.style.ERROR('No existing sessions to learn a pattern from. Run seed first.'))
            return

        existing = set(
            ClassSession.objects.filter(session_date__gte=today)
            .values_list('gym_class_id', 'trainer_id', 'session_date', 'start_time')
        )

        created = skipped = 0
        day = today
        while day <= horizon:
            for (class_id, trainer_id, start, end, weekday), capacity in patterns.items():
                if weekday != day.weekday():
                    continue
                if (class_id, trainer_id, day, start) in existing:
                    continue
                try:
                    # save() runs full_clean(), which rejects a trainer being
                    # double-booked — let it filter collisions for us.
                    ClassSession.objects.create(
                        gym_class_id=class_id, trainer_id=trainer_id,
                        session_date=day, start_time=start, end_time=end,
                        capacity=capacity,
                    )
                    created += 1
                except ValidationError:
                    skipped += 1
            day += timedelta(days=1)

        self.stdout.write(self.style.SUCCESS(
            f'Created {created} upcoming sessions through {horizon} ({skipped} skipped as conflicts).'
        ))
