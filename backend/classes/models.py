"""
Models for the classes app: the class categories (``GymClass``) and their
scheduled occurrences (``ClassSession``).

Mapping to the SRS data model: GymClass (6.8), ClassSession (6.9).
"""

from django.core.exceptions import ValidationError
from django.db import models


class GymClass(models.Model):
    """A type/category of class offered by the gym (SRS 6.8)."""

    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class ClassSession(models.Model):
    
    gym_class = models.ForeignKey(
        GymClass, on_delete=models.CASCADE, related_name='sessions'
    )
    trainer = models.ForeignKey(
        'accounts.Trainer', on_delete=models.PROTECT, related_name='sessions'
    )
    session_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    capacity = models.PositiveIntegerField(default=20)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['session_date', 'start_time']

    def __str__(self):
        return f'{self.gym_class.name} - {self.session_date} {self.start_time}'

    def clean(self):
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValidationError('start_time must be earlier than end_time.')

        if self.trainer_id and self.session_date and self.start_time and self.end_time:
            overlapping = ClassSession.objects.filter(
                trainer_id=self.trainer_id,
                session_date=self.session_date,
            ).exclude(pk=self.pk)
            for other in overlapping:
                if self.start_time < other.end_time and other.start_time < self.end_time:
                    raise ValidationError(
                        'Trainer already has an overlapping session at this time.'
                    )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def booked_count(self):
        """Number of currently confirmed bookings for this session."""
        return self.bookings.filter(status='CONFIRMED').count()

    @property
    def is_full(self):
        return self.booked_count >= self.capacity

    @property
    def remaining_capacity(self):
        return max(self.capacity - self.booked_count, 0)
