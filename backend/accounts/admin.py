"""Admin registration for the accounts app."""

from django.contrib import admin

from .models import Member, Trainer, TrainerMemberAssignment, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'full_name', 'role', 'is_active', 'is_staff', 'created_at')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('email', 'full_name', 'phone')
    ordering = ('-created_at',)


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'gender', 'date_of_birth', 'created_at')
    search_fields = ('user__email', 'user__full_name')


@admin.register(Trainer)
class TrainerAdmin(admin.ModelAdmin):
    list_display = ('user', 'specialization', 'experience_years', 'created_at')
    search_fields = ('user__email', 'user__full_name', 'specialization')
    list_filter = ('specialization',)


@admin.register(TrainerMemberAssignment)
class TrainerMemberAssignmentAdmin(admin.ModelAdmin):
    list_display = ('trainer', 'member', 'status', 'assigned_at')
    list_filter = ('status',)
    search_fields = (
        'member__user__email',
        'trainer__user__email',
        'member__user__full_name',
        'trainer__user__full_name',
    )
