"""URL routes for the assistant app (mounted under /api/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('ai/chat/', views.ChatHistoryView.as_view(), name='ai-chat-history'),
    path('ai/chat/send/', views.SendMessageView.as_view(), name='ai-chat-send'),
]
