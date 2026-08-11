from django.contrib import admin

from .models import BodyProgress


@admin.register(BodyProgress)
class BodyProgressAdmin(admin.ModelAdmin):
    list_display = ('member', 'recorded_at', 'weight_kg', 'body_fat_percent')
    list_filter = ('recorded_at',)
    search_fields = ('member__user__email', 'member__user__full_name')
