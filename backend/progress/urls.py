"""URL routes for the progress app (mounted under /api/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('progress/', views.BodyProgressListCreateView.as_view(), name='progress-list'),
    path('progress/<int:pk>/', views.BodyProgressDetailView.as_view(), name='progress-detail'),
]
