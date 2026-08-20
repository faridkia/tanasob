"""Serializers for the assistant app."""

from rest_framework import serializers

from .models import ChatMessage


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ('id', 'role', 'content', 'created_at')
        read_only_fields = fields


class SendMessageSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=2000, allow_blank=False)
