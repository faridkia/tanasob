"""
Views for the notifications app.

Users list their notifications, mark individual or all as read, and check
unread count (FR-NOTIF-1..FR-NOTIF-3).
"""

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdmin
from common.sms import send_sms as send_real_sms

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(generics.ListAPIView):
    """List the current user's notifications, newest first."""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationDetailView(generics.RetrieveAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class MarkNotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        notif.is_read = True
        notif.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notif).data)


class MarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        count = Notification.objects.filter(
            user=request.user, is_read=False,
        ).update(is_read=True)
        return Response({'marked_read': count})


class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({'unread_count': count})


class BroadcastNotificationView(APIView):
    """Admin sends an announcement to everyone in their own gym (never
    cross-tenant) — an in-app Notification per recipient, and optionally a
    real SMS via sms.ir to whoever has a phone number on file."""

    permission_classes = [IsAdmin]

    def post(self, request):
        from accounts.models import User

        title = (request.data.get('title') or '').strip()
        message = (request.data.get('message') or '').strip()
        audience = request.data.get('audience', 'ALL')
        want_sms = bool(request.data.get('send_sms'))

        if not title or not message:
            return Response(
                {'detail': 'عنوان و متن پیام الزامی است.'}, status=status.HTTP_400_BAD_REQUEST
            )
        if audience not in ('ALL', 'MEMBERS', 'TRAINERS'):
            return Response({'detail': 'مخاطب نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)

        recipients = User.objects.filter(organization=request.user.organization, is_active=True)
        if audience == 'MEMBERS':
            recipients = recipients.filter(role=User.Role.MEMBER)
        elif audience == 'TRAINERS':
            recipients = recipients.filter(role=User.Role.TRAINER)
        else:
            recipients = recipients.filter(role__in=[User.Role.MEMBER, User.Role.TRAINER])

        notified = 0
        sms_sent = 0
        sms_attempted = 0
        for user in recipients:
            Notification.objects.create(
                user=user, title=title, message=message, type=Notification.Type.ANNOUNCEMENT
            )
            notified += 1
            if want_sms and user.phone:
                sms_attempted += 1
                if send_real_sms(user.phone, f'{title}\n{message}'):
                    sms_sent += 1

        return Response({
            'notified': notified,
            'sms_attempted': sms_attempted,
            'sms_sent': sms_sent,
        })
