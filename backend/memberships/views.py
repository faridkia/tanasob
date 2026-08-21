"""
Views for the memberships app.

Admins manage plans, subscriptions and payments; members browse plans,
purchase subscriptions (mock payment) and view their own subscription/payment
history.
"""

from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdmin, IsMember

from .models import MembershipPlan, Payment, Subscription
from .serializers import (
    MembershipPlanSerializer,
    PaymentSerializer,
    SubscribeSerializer,
    SubscriptionSerializer,
)
from .services import cancel_subscription, expire_due_subscriptions, purchase_subscription


class MembershipPlanListCreateView(generics.ListCreateAPIView):
    """List/create membership plans (FR-MEM-1).

    - GET: any authenticated user (members only see active plans).
    - POST: admin only.
    """

    serializer_class = MembershipPlanSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = MembershipPlan.objects.all()
        if self.request.user.is_member:
            qs = qs.filter(is_active=True)
        return qs


class MembershipPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve/update/delete a plan — admin only."""

    queryset = MembershipPlan.objects.all()
    serializer_class = MembershipPlanSerializer
    permission_classes = [IsAdmin]


class SubscribeView(APIView):
    """Member purchases a subscription via mock payment (FR-MEM-2..FR-MEM-5)."""

    permission_classes = [IsMember]

    def post(self, request):
        serializer = SubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = serializer.validated_data['plan']
        member = request.user.member_profile
        try:
            subscription, payment = purchase_subscription(member, plan)
        except ValueError as exc:
            raise ValidationError(str(exc))
        return Response(
            {
                'subscription': SubscriptionSerializer(subscription).data,
                'payment': PaymentSerializer(payment).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CancelSubscriptionView(APIView):
    """Member cancels their own active subscription."""

    permission_classes = [IsMember]

    def post(self, request, pk):
        try:
            subscription = Subscription.objects.get(pk=pk, member=request.user.member_profile)
        except Subscription.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        try:
            cancel_subscription(subscription)
        except ValueError as exc:
            raise ValidationError(str(exc))
        return Response(SubscriptionSerializer(subscription).data)


class MySubscriptionsView(generics.ListAPIView):
    """Member views their own subscription history (US-M10)."""

    serializer_class = SubscriptionSerializer
    permission_classes = [IsMember]

    def get_queryset(self):
        expire_due_subscriptions()
        return Subscription.objects.filter(member=self.request.user.member_profile)


class MyPaymentsView(generics.ListAPIView):
    """Member views their own payment history (FR-MEM-5)."""

    serializer_class = PaymentSerializer
    permission_classes = [IsMember]

    def get_queryset(self):
        return Payment.objects.filter(
            subscription__member=self.request.user.member_profile
        )


class AdminSubscriptionListView(generics.ListAPIView):
    """Admin views all subscriptions (US-A6)."""

    serializer_class = SubscriptionSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ['status', 'plan']
    search_fields = ['member__user__email', 'member__user__full_name']

    def get_queryset(self):
        expire_due_subscriptions()
        return Subscription.objects.select_related('member__user', 'plan')


class AdminPaymentListView(generics.ListAPIView):
    """Admin views all payments (US-A6)."""

    serializer_class = PaymentSerializer
    permission_classes = [IsAdmin]
    queryset = Payment.objects.select_related('subscription__member__user')
    filterset_fields = ['status']
    search_fields = ['transaction_ref', 'subscription__member__user__email']
