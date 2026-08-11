"""Admin registration for the classes app."""

from django.contrib import admin

from .models import ClassSession, GymClass


@admin.register(GymClass)
class GymClassAdmin(admin.ModelAdmin):
    list_display = ('name', 'category')
    list_filter = ('category',)
    search_fields = ('name', 'category')


@admin.register(ClassSession)
class ClassSessionAdmin(admin.ModelAdmin):
    list_display = ('gym_class', 'trainer', 'session_date', 'start_time', 'end_time', 'capacity')
    list_filter = ('session_date', 'gym_class')
    search_fields = ('gym_class__name', 'trainer__user__full_name')
