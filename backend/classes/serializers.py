"""Serializers for the classes app."""

from rest_framework import serializers

from common.richtext import sanitize_html

from .models import ClassSession, GymClass


class GymClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = GymClass
        fields = ('id', 'name', 'category', 'description', 'description_html', 'cover_image', 'created_at')
        read_only_fields = ('id', 'created_at')

    def validate_description_html(self, value):
        return sanitize_html(value)


class ClassSessionSerializer(serializers.ModelSerializer):
    """Session serializer that includes derived availability fields (FR-CLS-3)."""

    gym_class_name = serializers.CharField(source='gym_class.name', read_only=True)
    trainer_name = serializers.CharField(source='trainer.user.full_name', read_only=True)
    booked_count = serializers.IntegerField(read_only=True)
    remaining_capacity = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)

    class Meta:
        model = ClassSession
        fields = (
            'id',
            'gym_class',
            'gym_class_name',
            'trainer',
            'trainer_name',
            'session_date',
            'start_time',
            'end_time',
            'capacity',
            'booked_count',
            'remaining_capacity',
            'is_full',
            'created_at',
        )
        read_only_fields = ('id', 'created_at', 'booked_count', 'remaining_capacity', 'is_full')
