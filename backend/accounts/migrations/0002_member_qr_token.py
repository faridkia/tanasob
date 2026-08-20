import uuid

from django.db import migrations, models


def _assign_qr_tokens(apps, schema_editor):
    Member = apps.get_model('accounts', 'Member')
    for member in Member.objects.all():
        member.qr_token = uuid.uuid4()
        member.save(update_fields=['qr_token'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='member',
            name='qr_token',
            field=models.UUIDField(default=uuid.uuid4, editable=False),
        ),
        migrations.RunPython(_assign_qr_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='member',
            name='qr_token',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
