"""URL routes for the activities app (mounted under /api/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('activities/', views.ActivityLogListCreateView.as_view(), name='activity-list'),
    path('activities/summary/', views.ActivitySummaryView.as_view(), name='activity-summary'),
]
