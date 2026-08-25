from django.contrib import admin

from .models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('member', 'activity_type', 'duration_seconds', 'calories_burned', 'created_at')
    list_filter = ('activity_type',)
