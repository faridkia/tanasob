"""Serializers for the events app."""

from django.utils import timezone
from rest_framework import serializers

from .models import Event


class EventSerializer(serializers.ModelSerializer):
    days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = (
            'id', 'title', 'description', 'location', 'image',
            'event_date', 'is_active', 'days_remaining', 'created_at',
        )
        read_only_fields = ('id', 'created_at')

    def get_days_remaining(self, obj):
        return (obj.event_date - timezone.localdate()).days
