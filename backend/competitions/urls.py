"""URL routes for the competitions app (mounted under /api/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('competitions/', views.CompetitionListCreateView.as_view(), name='competition-list'),
    path('competitions/<int:pk>/', views.CompetitionDetailView.as_view(), name='competition-detail'),
    path('competitions/<int:pk>/join/', views.JoinCompetitionView.as_view(), name='competition-join'),
]
