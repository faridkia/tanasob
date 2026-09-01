"""URL routes for the progress app (mounted under /api/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('progress/', views.BodyProgressListCreateView.as_view(), name='progress-list'),
    path('progress/<int:pk>/', views.BodyProgressDetailView.as_view(), name='progress-detail'),
    path('progress/leaderboard/', views.LeaderboardView.as_view(), name='leaderboard'),
    path('progress/leaderboard/history/', views.LeaderboardHistoryView.as_view(), name='leaderboard-history'),
    path('progress/leaderboard/grant-rewards/', views.GrantLeaderboardRewardsView.as_view(), name='leaderboard-grant-rewards'),
    path('progress/me/points/', views.MyPointsView.as_view(), name='my-points'),
    path('progress/me/coach/', views.MyCoachView.as_view(), name='my-coach'),
    path('progress/me/goal-settings/', views.MyGoalSettingsView.as_view(), name='my-goal-settings'),
    path('progress/me/goals/', views.MyGoalsView.as_view(), name='my-goals'),
]
