"""URL routes for the classes app (mounted under /api/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('classes/', views.GymClassListCreateView.as_view(), name='gymclass-list'),
    path('classes/<int:pk>/', views.GymClassDetailView.as_view(), name='gymclass-detail'),
    path('classes/<int:pk>/history/', views.GymClassHistoryView.as_view(), name='gymclass-history'),
    path('sessions/', views.ClassSessionListCreateView.as_view(), name='session-list'),
    path('sessions/<int:pk>/', views.ClassSessionDetailView.as_view(), name='session-detail'),
]
