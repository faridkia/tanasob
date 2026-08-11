"""
Admin reporting endpoints (FR-REP-1..FR-REP-4).

These are read-only aggregation views; they have no model of their own and
query across the other apps.
"""

from django.db.models import Count, Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdmin

from bookings.models import Attendance, Booking
from classes.models import ClassSession, GymClass
from memberships.models import Payment, Subscription


class SubscriptionReportView(APIView):
    """FR-REP-1: active vs expired/cancelled subscriptions."""

    permission_classes = [IsAdmin]

    def get(self, request):
        total = Subscription.objects.count()
        active = Subscription.objects.filter(status=Subscription.Status.ACTIVE).count()
        expired = Subscription.objects.filter(status=Subscription.Status.EXPIRED).count()
        cancelled = Subscription.objects.filter(status=Subscription.Status.CANCELLED).count()
        return Response({
            'total': total,
            'active': active,
            'expired': expired,
            'cancelled': cancelled,
        })


class RevenueReportView(APIView):
    """FR-REP-2: mock revenue over a selectable date range (?from=&to=)."""

    permission_classes = [IsAdmin]

    def get(self, request):
        qs = Payment.objects.filter(status=Payment.Status.SUCCESS)
        date_from = request.query_params.get('from')
        date_to = request.query_params.get('to')
        if date_from:
            qs = qs.filter(paid_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(paid_at__date__lte=date_to)
        agg = qs.aggregate(total=Sum('amount'), count=Count('id'))
        return Response({
            'from': date_from,
            'to': date_to,
            'total_revenue': agg['total'] or 0,
            'successful_payments': agg['count'] or 0,
        })


class AttendanceReportView(APIView):
    """FR-REP-3: attendance statistics per session."""

    permission_classes = [IsAdmin]

    def get(self, request):
        sessions = ClassSession.objects.annotate(
            attendance_count=Count('attendances'),
            booking_count=Count('bookings', distinct=True),
        ).order_by('-attendance_count')[:50]
        data = [
            {
                'session_id': s.id,
                'gym_class': s.gym_class.name,
                'session_date': s.session_date,
                'capacity': s.capacity,
                'bookings': s.booking_count,
                'attendance': s.attendance_count,
            }
            for s in sessions
        ]
        return Response(data)


class PopularReportView(APIView):
    """FR-REP-4: most popular classes and trainers (by bookings)."""

    permission_classes = [IsAdmin]

    def get(self, request):
        popular_classes = (
            GymClass.objects.annotate(
                total_bookings=Count('sessions__bookings', distinct=True),
            )
            .order_by('-total_bookings')[:10]
        )
        from accounts.models import Trainer

        popular_trainers = (
            Trainer.objects.annotate(
                total_bookings=Count('sessions__bookings', distinct=True),
            )
            .order_by('-total_bookings')[:10]
        )
        return Response({
            'popular_classes': [
                {'name': c.name, 'category': c.category, 'total_bookings': c.total_bookings}
                for c in popular_classes
            ],
            'popular_trainers': [
                {
                    'name': t.user.full_name,
                    'specialization': t.specialization,
                    'total_bookings': t.total_bookings,
                }
                for t in popular_trainers
            ],
        })
