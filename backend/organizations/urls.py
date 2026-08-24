"""URL routes for the organizations app (mounted under /api/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('organizations/', views.OrganizationListView.as_view(), name='organization-list'),
    path('organizations/register/', views.RegisterOrganizationView.as_view(), name='organization-register'),
]
