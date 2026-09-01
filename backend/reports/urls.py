"""URL routes for the reports app (mounted under /api/, admin only)."""

from django.urls import path

from . import views

urlpatterns = [
    path('reports/subscriptions/', views.SubscriptionReportView.as_view(), name='report-subscriptions'),
    path('reports/revenue/', views.RevenueReportView.as_view(), name='report-revenue'),
    path('reports/attendance/', views.AttendanceReportView.as_view(), name='report-attendance'),
    path('reports/popular/', views.PopularReportView.as_view(), name='report-popular'),
    path('reports/trends/', views.AnalyticsTrendView.as_view(), name='report-trends'),
    path('reports/overview/', views.AnalyticsOverviewView.as_view(), name='report-overview'),
]
