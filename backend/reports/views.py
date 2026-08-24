"""
Admin reporting endpoints (FR-REP-1..FR-REP-4).

These are read-only aggregation views; they have no model of their own and
query across the other apps.
"""

from datetime import timedelta

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdmin

from accounts.models import User
from bookings.models import Attendance, Booking
from classes.models import ClassSession, GymClass
from memberships.models import Payment, Subscription
from memberships.services import expire_due_subscriptions


class SubscriptionReportView(APIView):
    """FR-REP-1: active vs expired/cancelled subscriptions."""

    permission_classes = [IsAdmin]

    def get(self, request):
        expire_due_subscriptions()
        base = Subscription.objects.filter(member__user__organization=request.user.organization)
        total = base.count()
        active = base.filter(status=Subscription.Status.ACTIVE).count()
        expired = base.filter(status=Subscription.Status.EXPIRED).count()
        cancelled = base.filter(status=Subscription.Status.CANCELLED).count()
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
        qs = Payment.objects.filter(
            status=Payment.Status.SUCCESS,
            subscription__member__user__organization=request.user.organization,
        )
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
        sessions = ClassSession.objects.filter(
            gym_class__organization=request.user.organization
        ).annotate(
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
            GymClass.objects.filter(organization=request.user.organization)
            .annotate(
                total_bookings=Count('sessions__bookings', distinct=True),
            )
            .order_by('-total_bookings')[:10]
        )
        from accounts.models import Trainer

        popular_trainers = (
            Trainer.objects.filter(user__organization=request.user.organization)
            .annotate(
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


class AnalyticsTrendView(APIView):
    """Admin analytics dashboard: revenue and member-growth trend over the
    last 6 months, plus a per-weekday attendance breakdown — for the richer
    admin dashboard charts."""

    permission_classes = [IsAdmin]

    def get(self, request):
        org = request.user.organization
        today = timezone.localdate()
        six_months_ago = today.replace(day=1) - timedelta(days=180)

        revenue_rows = (
            Payment.objects.filter(
                status=Payment.Status.SUCCESS,
                paid_at__date__gte=six_months_ago,
                subscription__member__user__organization=org,
            )
            .annotate(month=TruncMonth('paid_at'))
            .values('month')
            .annotate(total=Sum('amount'), count=Count('id'))
            .order_by('month')
        )
        revenue_trend = [
            {'month': row['month'].strftime('%Y-%m'), 'total': row['total'] or 0, 'count': row['count']}
            for row in revenue_rows
        ]

        growth_rows = (
            User.objects.filter(
                organization=org,
                role__in=[User.Role.MEMBER, User.Role.TRAINER],
                created_at__date__gte=six_months_ago,
            )
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month')
        )
        member_growth = [
            {'month': row['month'].strftime('%Y-%m'), 'count': row['count']}
            for row in growth_rows
        ]

        weekday_labels = ['دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه', 'یکشنبه']
        attendance_by_weekday = [0] * 7
        for record in Attendance.objects.filter(member__user__organization=org).values_list('check_in_time', flat=True):
            attendance_by_weekday[record.weekday()] += 1
        weekday_breakdown = [
            {'label': label, 'count': count} for label, count in zip(weekday_labels, attendance_by_weekday)
        ]

        return Response({
            'revenue_trend': revenue_trend,
            'member_growth': member_growth,
            'weekday_breakdown': weekday_breakdown,
        })
