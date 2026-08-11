"""Serializers for the notifications app."""

from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ('id', 'title', 'message', 'type', 'is_read', 'created_at')
        read_only_fields = ('id', 'title', 'message', 'type', 'created_at')
