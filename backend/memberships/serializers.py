"""Serializers for the memberships app."""

from rest_framework import serializers

from .models import LeaderboardReward, MembershipPlan, Payment, Subscription


class MembershipPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = MembershipPlan
        fields = (
            'id',
            'name',
            'duration_days',
            'price',
            'description',
            'is_active',
            'created_at',
        )
        read_only_fields = ('id', 'created_at')


class SubscriptionSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    member_email = serializers.CharField(source='member.user.email', read_only=True)
    member_name = serializers.CharField(source='member.user.full_name', read_only=True)
    is_currently_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = Subscription
        fields = (
            'id',
            'member',
            'member_email',
            'member_name',
            'plan',
            'plan_name',
            'start_date',
            'end_date',
            'status',
            'is_currently_active',
            'created_at',
        )
        read_only_fields = (
            'id',
            'member',
            'start_date',
            'end_date',
            'status',
            'is_currently_active',
            'created_at',
        )


class PaymentSerializer(serializers.ModelSerializer):
    subscription_id = serializers.IntegerField(source='subscription.id', read_only=True)
    member_email = serializers.CharField(
        source='subscription.member.user.email', read_only=True
    )

    class Meta:
        model = Payment
        fields = (
            'id',
            'subscription',
            'subscription_id',
            'member_email',
            'amount',
            'method',
            'status',
            'transaction_ref',
            'paid_at',
            'created_at',
        )
        read_only_fields = (
            'id',
            'amount',
            'method',
            'status',
            'transaction_ref',
            'paid_at',
            'created_at',
        )


class SubscribeSerializer(serializers.Serializer):
    """Input for the subscribe endpoint: just the chosen plan id."""

    plan = serializers.PrimaryKeyRelatedField(queryset=MembershipPlan.objects.filter(is_active=True))


class LeaderboardRewardSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaderboardReward
        fields = ('id', 'rank', 'percent', 'is_redeemed', 'granted_at', 'redeemed_at')
        read_only_fields = fields
