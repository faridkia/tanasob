"""URL routes for the accounts app (mounted under /api/auth/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('me/', views.MeView.as_view(), name='me'),
    path('change-password/', views.ChangePasswordView.as_view(), name='change-password'),
    path(
        'assignments/',
        views.TrainerMemberAssignmentView.as_view(),
        name='assignments-list',
    ),
    path(
        'assignments/<int:pk>/',
        views.AssignmentDetailView.as_view(),
        name='assignment-detail',
    ),
]
