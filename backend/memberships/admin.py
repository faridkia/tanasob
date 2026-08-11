"""Admin registration for the memberships app."""

from django.contrib import admin

from .models import MembershipPlan, Payment, Subscription


@admin.register(MembershipPlan)
class MembershipPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'duration_days', 'price', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name',)


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('member', 'plan', 'start_date', 'end_date', 'status')
    list_filter = ('status', 'plan')
    search_fields = ('member__user__email', 'member__user__full_name')


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('subscription', 'amount', 'status', 'method', 'paid_at')
    list_filter = ('status', 'method')
    search_fields = ('transaction_ref', 'subscription__member__user__email')
