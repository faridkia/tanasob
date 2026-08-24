"""URL routes for the accounts app (mounted under /api/auth/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('me/', views.MeView.as_view(), name='me'),
    path('me/qr/', views.MyQRCodeView.as_view(), name='me-qr'),
    path('me/face/', views.MyFaceEnrollView.as_view(), name='me-face'),
    path('change-password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('trainers/', views.TrainerListView.as_view(), name='trainers-list'),
    path('members/', views.MemberListView.as_view(), name='members-list'),
    path('users/', views.AdminUserListCreateView.as_view(), name='admin-users-list'),
    path('users/<int:pk>/', views.AdminUserDetailView.as_view(), name='admin-user-detail'),
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
