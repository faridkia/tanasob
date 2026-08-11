"""URL routes for the memberships app (mounted under /api/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('plans/', views.MembershipPlanListCreateView.as_view(), name='plan-list'),
    path('plans/<int:pk>/', views.MembershipPlanDetailView.as_view(), name='plan-detail'),
    path('subscribe/', views.SubscribeView.as_view(), name='subscribe'),
    path('subscriptions/me/', views.MySubscriptionsView.as_view(), name='my-subscriptions'),
    path('payments/me/', views.MyPaymentsView.as_view(), name='my-payments'),
    path('admin/subscriptions/', views.AdminSubscriptionListView.as_view(), name='admin-subscriptions'),
    path('admin/payments/', views.AdminPaymentListView.as_view(), name='admin-payments'),
]
