"""URL routes for the bookings app (mounted under /api/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('bookings/', views.BookingListCreateView.as_view(), name='booking-list'),
    path('bookings/<int:pk>/', views.BookingDetailView.as_view(), name='booking-detail'),
    path('bookings/<int:pk>/cancel/', views.CancelBookingView.as_view(), name='booking-cancel'),
    path('attendance/', views.AttendanceListView.as_view(), name='attendance-list'),
    path('attendance/check-in/', views.CheckInView.as_view(), name='attendance-checkin'),
]
