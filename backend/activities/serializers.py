"""Serializers for the activities app."""

from rest_framework import serializers

from .models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLog
        fields = (
            'id', 'activity_type', 'workout_plan', 'duration_seconds',
            'calories_burned', 'distance_km', 'created_at',
        )
        read_only_fields = ('id', 'created_at')

    def validate_workout_plan(self, value):
        user = self.context['request'].user
        if value and value.member_id != user.member_profile.id:
            raise serializers.ValidationError('این برنامه تمرینی متعلق به شما نیست.')
        return value
