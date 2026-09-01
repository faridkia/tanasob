"""Serializers for the messaging app."""

from rest_framework import serializers

from .models import Message


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.full_name', read_only=True)
    sender_role = serializers.CharField(source='sender.role', read_only=True)

    class Meta:
        model = Message
        fields = (
            'id', 'sender', 'sender_name', 'sender_role',
            'receiver', 'content', 'sent_at',
            'edited_at', 'is_read',
        )
        read_only_fields = ('id', 'sender', 'sender_name', 'sender_role', 'sent_at', 'is_read')


class SendMessageSerializer(serializers.Serializer):
    content = serializers.CharField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.fields['receiver'] = serializers.PrimaryKeyRelatedField(
            queryset=User.objects.all()
        )
