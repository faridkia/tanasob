"""Give every gym its own copy of the exercise library.

Until now the seeded exercises had ``organization=None``, meaning one shared
row was visible to every gym on the platform. That made "the admin manages
the library" impossible to honour: editing or deleting a shared row would
have silently changed what a *different* gym sees, so admins were locked out
of all 14 of them and could only touch exercises they had added themselves.

Cloning per organization removes the conflict instead of working around it.
Each gym gets its own rows, an admin can rename or delete anything in their
own library, and no edit can ever cross a tenant boundary. Plan items are
re-pointed to the copy belonging to the plan's own gym before the shared
rows are removed, so nothing loses its exercise.
"""

from django.db import migrations


def split_library_per_org(apps, schema_editor):
    Exercise = apps.get_model('plans', 'Exercise')
    Organization = apps.get_model('organizations', 'Organization')
    WorkoutPlanItem = apps.get_model('plans', 'WorkoutPlanItem')

    shared = list(Exercise.objects.filter(organization__isnull=True))
    if not shared:
        return

    # org id -> {old exercise id: new exercise id}
    copies = {}
    for org in Organization.objects.all():
        mapping = {}
        for ex in shared:
            clone = Exercise.objects.create(
                organization=org,
                created_by=None,  # seeded, so no trainer owns it
                name=ex.name,
                muscle_group=ex.muscle_group,
                video_url=ex.video_url,
                description=ex.description,
            )
            mapping[ex.id] = clone.id
        copies[org.id] = mapping

    # Re-point every plan item to its own gym's copy. The gym is reached
    # through the plan's member, which is the same path the app itself uses
    # for tenant scoping.
    items = WorkoutPlanItem.objects.select_related(
        'day__workout_plan__member__user'
    ).filter(exercise__organization__isnull=True)
    for item in items:
        org_id = item.day.workout_plan.member.user.organization_id
        mapped = copies.get(org_id, {}).get(item.exercise_id)
        if mapped:
            item.exercise_id = mapped
            item.save(update_fields=['exercise'])

    # Anything still pointing at a shared row would block the delete
    # (exercise is PROTECT), so only delete once nothing references them.
    Exercise.objects.filter(
        organization__isnull=True, plan_items__isnull=True
    ).delete()


def merge_library(apps, schema_editor):
    """Reverse: fold the per-gym copies back into one shared library."""
    Exercise = apps.get_model('plans', 'Exercise')
    WorkoutPlanItem = apps.get_model('plans', 'WorkoutPlanItem')

    seen = {}
    for ex in Exercise.objects.exclude(organization__isnull=True).order_by('id'):
        key = (ex.name, ex.muscle_group)
        if key not in seen:
            ex.organization = None
            ex.save(update_fields=['organization'])
            seen[key] = ex.id
        else:
            WorkoutPlanItem.objects.filter(exercise_id=ex.id).update(exercise_id=seen[key])
            ex.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('plans', '0010_exercise_created_by'),
        ('organizations', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(split_library_per_org, merge_library),
    ]
