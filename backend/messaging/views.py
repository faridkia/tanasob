"""
Views for the messaging app.

Members and trainers exchange text messages (FR-MSG-1..FR-MSG-3).
Only assigned member-trainer pairs can message each other.
"""

from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import TrainerMemberAssignment

from notifications.services import notify
from notifications.models import Notification

from .models import Message
from .serializers import MessageSerializer, SendMessageSerializer


def _are_connected(user_a, user_b):
    """Return True if user_a and user_b have an active assignment."""
    from accounts.models import Member, Trainer

    try:
        member_a = user_a.member_profile
        trainer_b = user_b.trainer_profile
    except (Member.DoesNotExist, Trainer.DoesNotExist):
        pass
    else:
        return TrainerMemberAssignment.objects.filter(
            member=member_a, trainer=trainer_b, status='ACTIVE'
        ).exists()

    try:
        trainer_a = user_a.trainer_profile
        member_b = user_b.member_profile
    except (Trainer.DoesNotExist, Member.DoesNotExist):
        pass
    else:
        return TrainerMemberAssignment.objects.filter(
            member=member_b, trainer=trainer_a, status='ACTIVE'
        ).exists()

    return False


class ConversationView(generics.ListAPIView):
    """GET messages between the current user and another user (FR-MSG-2).

    ?with=<user_id> — the other participant.
    """
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        other_id = self.request.query_params.get('with')
        if not other_id:
            raise ValidationError('Query parameter ?with=<user_id> is required.')
        qs = Message.objects.filter(
            sender=user, receiver_id=other_id,
        ) | Message.objects.filter(
            sender_id=other_id, receiver=user,
        )
        return qs.order_by('sent_at')


class SendMessageView(APIView):
    """POST a message to another user (FR-MSG-1)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        receiver = serializer.validated_data['receiver']
        content = serializer.validated_data['content']

        if not _are_connected(request.user, receiver):
            raise PermissionDenied(
                'You can only message trainers assigned to you or members you train.'
            )

        msg = Message.objects.create(
            sender=request.user,
            receiver=receiver,
            content=content,
        )

        # Notify receiver (FR-NOTIF-3)
        notify(
            receiver,
            title=f'New message from {request.user.full_name}',
            message=content[:120],
            type_=Notification.Type.MESSAGE,
        )

        return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class MarkMessagesReadView(APIView):
    """POST mark all unread messages from a specific user as read (FR-MSG-3)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        other_id = request.data.get('with')
        if not other_id:
            raise ValidationError('Field "with" (user id) is required.')
        count = Message.objects.filter(
            sender_id=other_id, receiver=request.user, is_read=False,
        ).update(is_read=True)
        return Response({'marked_read': count})
