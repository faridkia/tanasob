"""Backfill WorkoutDay.date from the old day_number sequence.

Workout plans move from an abstract "Day 1 / Day 2" sequence to real
calendar dates so members can see them on an actual calendar. Every
existing day gets `workout_plan.start_date + (day_number - 1) days`, which
preserves the same relative ordering.
"""

from datetime import timedelta

from django.db import migrations


def backfill(apps, schema_editor):
    WorkoutDay = apps.get_model('plans', 'WorkoutDay')
    for day in WorkoutDay.objects.select_related('workout_plan').all():
        day.date = day.workout_plan.start_date + timedelta(days=day.day_number - 1)
        day.save(update_fields=['date'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('plans', '0007_alter_workoutday_options_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill, noop_reverse),
    ]
