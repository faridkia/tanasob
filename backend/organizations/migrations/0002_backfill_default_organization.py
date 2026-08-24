"""Backfill every pre-multi-tenant row into one default Organization
("باشگاه تناسب") so nothing already in the database breaks once User,
GymClass and MembershipPlan require an organization.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    Organization = apps.get_model('organizations', 'Organization')
    User = apps.get_model('accounts', 'User')
    GymClass = apps.get_model('classes', 'GymClass')
    MembershipPlan = apps.get_model('memberships', 'MembershipPlan')

    if not (User.objects.exists() or GymClass.objects.exists() or MembershipPlan.objects.exists()):
        return

    org, _ = Organization.objects.get_or_create(
        slug='tanasob',
        defaults={'name': 'باشگاه تناسب'},
    )

    # Django superusers (createsuperuser, /admin/-only) stay org-less —
    # they're platform-level, not tied to any single gym.
    User.objects.filter(organization__isnull=True, is_superuser=False).update(organization=org)
    GymClass.objects.filter(organization__isnull=True).update(organization=org)
    MembershipPlan.objects.filter(organization__isnull=True).update(organization=org)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0001_initial'),
        ('accounts', '0003_user_organization'),
        ('classes', '0002_gymclass_organization_alter_gymclass_name'),
        ('memberships', '0002_membershipplan_organization_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill, noop_reverse),
    ]
