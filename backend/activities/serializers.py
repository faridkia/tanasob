"""Serializers for the activities app."""

from django.utils import timezone
from rest_framework import serializers

from .models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLog
        fields = (
            'id', 'activity_type', 'workout_plan', 'workout_day', 'duration_seconds',
            'calories_burned', 'distance_km', 'created_at',
        )
        read_only_fields = ('id', 'created_at')

    def validate_workout_plan(self, value):
        user = self.context['request'].user
        if value and value.member_id != user.member_profile.id:
            raise serializers.ValidationError('این برنامه تمرینی متعلق به شما نیست.')
        return value

    def validate_workout_day(self, value):
        """A workout can be logged on or after its scheduled date — never before.

        Enforced here rather than only in the UI: the run page is reachable
        by URL, and the API accepts requests that never went near it. Letting
        a member tick off a plan the trainer scheduled for next week would
        make attendance, streaks, tiers and the leaderboard all lie.
        """
        if value is None:
            return value
        user = self.context['request'].user
        if value.workout_plan.member_id != user.member_profile.id:
            raise serializers.ValidationError('این روز تمرینی متعلق به شما نیست.')
        if value.date > timezone.localdate():
            raise serializers.ValidationError(
                'این تمرین برای یک روز آینده برنامه‌ریزی شده و هنوز نمی‌توانی آن را ثبت کنی.'
            )
        return value
