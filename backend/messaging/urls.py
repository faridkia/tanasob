"""URL routes for the messaging app (mounted under /api/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('messages/', views.ConversationView.as_view(), name='messages'),
    path('messages/send/', views.SendMessageView.as_view(), name='message-send'),
    path('messages/mark-read/', views.MarkMessagesReadView.as_view(), name='messages-mark-read'),
]
