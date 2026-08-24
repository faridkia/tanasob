"""Backfill the pre-day-split schema into the new one:

Every existing WorkoutPlan gets one WorkoutDay ("روز ۱"), and every distinct
existing free-text ``exercise_name`` becomes a global Exercise row
(``organization=None``) that the plan's items now point to.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    WorkoutPlan = apps.get_model('plans', 'WorkoutPlan')
    WorkoutPlanItem = apps.get_model('plans', 'WorkoutPlanItem')
    WorkoutDay = apps.get_model('plans', 'WorkoutDay')
    Exercise = apps.get_model('plans', 'Exercise')

    exercise_cache = {}

    def get_exercise(name):
        name = name.strip() or 'حرکت نامشخص'
        if name in exercise_cache:
            return exercise_cache[name]
        exercise, _ = Exercise.objects.get_or_create(
            organization=None, name=name, defaults={'muscle_group': 'FULL_BODY'}
        )
        exercise_cache[name] = exercise
        return exercise

    for plan in WorkoutPlan.objects.all():
        legacy_items = list(plan.legacy_items.all())
        if not legacy_items:
            continue
        day = WorkoutDay.objects.create(workout_plan=plan, day_number=1, label='روز ۱')
        for item in legacy_items:
            item.day = day
            item.exercise = get_exercise(item.exercise_name)
            item.save(update_fields=['day', 'exercise'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('plans', '0004_alter_workoutplanitem_exercise_name_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill, noop_reverse),
    ]
