"""Views for the assistant app: AI chat history and message sending."""

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChatMessage
from .serializers import ChatMessageSerializer, SendMessageSerializer
from .services import AssistantError, ask_assistant


class ChatHistoryView(generics.ListAPIView):
    """GET the current user's chat history with the assistant."""

    serializer_class = ChatMessageSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return ChatMessage.objects.filter(user=self.request.user)


class SendMessageView(APIView):
    """POST a message and get the assistant's reply."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            reply = ask_assistant(request.user, serializer.validated_data['message'])
        except AssistantError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(ChatMessageSerializer(reply).data, status=status.HTTP_201_CREATED)
