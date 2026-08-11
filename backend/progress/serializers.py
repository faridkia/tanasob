"""Serializers for the progress app."""

from rest_framework import serializers

from .models import BodyProgress


class BodyProgressSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.user.full_name', read_only=True)

    class Meta:
        model = BodyProgress
        fields = (
            'id', 'member', 'member_name', 'recorded_at',
            'weight_kg', 'body_fat_percent', 'waist_cm', 'notes',
        )
        read_only_fields = ('id', 'member', 'member_name')
