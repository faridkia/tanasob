"""URL routes for the progress app (mounted under /api/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('progress/', views.BodyProgressListCreateView.as_view(), name='progress-list'),
    path('progress/<int:pk>/', views.BodyProgressDetailView.as_view(), name='progress-detail'),
    path('progress/leaderboard/', views.LeaderboardView.as_view(), name='leaderboard'),
    path('progress/me/points/', views.MyPointsView.as_view(), name='my-points'),
    path('progress/me/goals/', views.MyGoalsView.as_view(), name='my-goals'),
]
