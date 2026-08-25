"""Serializers for the competitions app."""

from django.utils import timezone
from rest_framework import serializers

from .models import Competition, CompetitionPrize


class CompetitionPrizeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetitionPrize
        fields = ('id', 'rank', 'title')
        read_only_fields = ('id',)


class CompetitionSerializer(serializers.ModelSerializer):
    prizes = CompetitionPrizeSerializer(many=True)
    participant_count = serializers.SerializerMethodField()
    is_joined = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = Competition
        fields = (
            'id', 'title', 'description', 'kind', 'level', 'image',
            'start_date', 'end_date', 'is_active', 'prizes',
            'participant_count', 'is_joined', 'days_remaining', 'created_at',
        )
        read_only_fields = ('id', 'created_at')

    def get_participant_count(self, obj):
        return obj.participants.count()

    def get_is_joined(self, obj):
        user = self.context['request'].user
        if not user.is_member:
            return False
        return obj.participants.filter(member=user.member_profile).exists()

    def get_days_remaining(self, obj):
        return max((obj.end_date - timezone.localdate()).days, 0)

    def create(self, validated_data):
        prizes_data = validated_data.pop('prizes')
        competition = Competition.objects.create(**validated_data)
        for prize in prizes_data:
            CompetitionPrize.objects.create(competition=competition, **prize)
        return competition

    def update(self, instance, validated_data):
        prizes_data = validated_data.pop('prizes', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if prizes_data is not None:
            instance.prizes.all().delete()
            for prize in prizes_data:
                CompetitionPrize.objects.create(competition=instance, **prize)
        return instance
