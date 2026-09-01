"""URL routes for the notifications app (mounted under /api/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('notifications/', views.NotificationListView.as_view(), name='notification-list'),
    path('notifications/<int:pk>/', views.NotificationDetailView.as_view(), name='notification-detail'),
    path('notifications/<int:pk>/read/', views.MarkNotificationReadView.as_view(), name='notification-read'),
    path('notifications/read-all/', views.MarkAllReadView.as_view(), name='notification-read-all'),
    path('notifications/unread-count/', views.UnreadCountView.as_view(), name='notification-unread-count'),
    path('notifications/broadcast/', views.BroadcastNotificationView.as_view(), name='notification-broadcast'),
]
