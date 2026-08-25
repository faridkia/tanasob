"""
Models for the events app: gym-run happenings/announcements shown as the
dashboard hero slider (new branch openings, workshops, family days, ...).

Distinct from ``competitions.Competition`` — an event has no participants
or prizes, it's just an announced occasion members should know about.
"""

from django.db import models
from django.utils import timezone


class Event(models.Model):

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE, related_name='events'
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=150, blank=True)
    image = models.ImageField(upload_to='events/', null=True, blank=True)
    event_date = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['event_date']

    def __str__(self):
        return f'{self.title} ({self.event_date})'

    @property
    def is_upcoming(self):
        return self.event_date >= timezone.localdate()
