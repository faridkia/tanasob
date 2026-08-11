from django.contrib import admin

from .models import Attendance, Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('member', 'session', 'status', 'booked_at')
    list_filter = ('status',)
    search_fields = ('member__user__email', 'member__user__full_name')


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('member', 'session', 'check_in_time')
    search_fields = ('member__user__email',)
