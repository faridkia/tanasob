"""
Admin reporting endpoints (FR-REP-1..FR-REP-4).

These are read-only aggregation views; they have no model of their own and
query across the other apps.
"""

from datetime import timedelta

from django.db.models import Count, Q, Sum
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


def _pct(part, whole):
    """Percentage, rounded, with the empty-denominator case pinned to 0 so a
    brand-new gym reads as 0% rather than crashing or showing NaN."""
    return round(part / whole * 100) if whole else 0


class AnalyticsOverviewView(APIView):
    """The operational report an owner actually runs the gym from.

    The other report endpoints describe what happened (revenue, growth).
    This one answers the questions that cost money if you get them wrong:
    are members turning up, are classes worth running, and who is about to
    quit. Everything is scoped to the requesting admin's own organization
    and measured over a trailing 30-day window.
    """

    permission_classes = [IsAdmin]

    WINDOW_DAYS = 30
    AT_RISK_DAYS = 30
    EXPIRING_DAYS = 14

    def get(self, request):
        org = request.user.organization
        today = timezone.localdate()
        window_start = today - timedelta(days=self.WINDOW_DAYS)
        expire_due_subscriptions()

        # ---- Attendance & capacity, past sessions only -------------------
        # Future sessions are excluded deliberately: their bookings haven't
        # had a chance to become attendance yet, and including them drags
        # the rate down by however far ahead the schedule is published.
        past_sessions = ClassSession.objects.filter(
            gym_class__organization=org,
            session_date__gte=window_start,
            session_date__lte=today,
        )
        # Capacity is summed in its own query, NOT alongside the Counts.
        # Sum has no `distinct`, so joining bookings and attendances in the
        # same aggregate fans the session rows out and multiplies it (650
        # became 1280 here) — which silently wrecks every fill rate.
        total_capacity = past_sessions.aggregate(c=Sum('capacity'))['c'] or 0
        session_stats = past_sessions.aggregate(
            bookings=Count('bookings', filter=Q(bookings__status=Booking.Status.CONFIRMED), distinct=True),
            attendance=Count('attendances', distinct=True),
        )
        total_bookings = session_stats['bookings'] or 0
        total_attendance = session_stats['attendance'] or 0

        # ---- Members ------------------------------------------------------
        member_users = User.objects.filter(organization=org, role=User.Role.MEMBER)
        active_subs = Subscription.objects.filter(
            member__user__organization=org,
            status=Subscription.Status.ACTIVE,
            end_date__gte=today,
        )
        active_member_ids = set(active_subs.values_list('member_id', flat=True))
        active_members = len(active_member_ids)
        new_members = member_users.filter(created_at__date__gte=window_start).count()

        # ---- Money --------------------------------------------------------
        revenue_window = Payment.objects.filter(
            status=Payment.Status.SUCCESS,
            paid_at__date__gte=window_start,
            subscription__member__user__organization=org,
        ).aggregate(total=Sum('amount'))['total'] or 0

        # ---- Churn ---------------------------------------------------------
        # Subscriptions whose life ended inside the window, over the base of
        # everyone who was still subscribed at the window's start.
        ended = Subscription.objects.filter(
            member__user__organization=org,
            status__in=[Subscription.Status.EXPIRED, Subscription.Status.CANCELLED],
            end_date__gte=window_start,
            end_date__lte=today,
        ).count()
        churn_base = active_members + ended

        expiring = active_subs.filter(
            end_date__lte=today + timedelta(days=self.EXPIRING_DAYS)
        ).select_related('member__user', 'plan').order_by('end_date')

        # ---- At-risk: paying, but not turning up ---------------------------
        recent_attendee_ids = set(
            Attendance.objects.filter(
                member__user__organization=org,
                check_in_time__date__gte=today - timedelta(days=self.AT_RISK_DAYS),
            ).values_list('member_id', flat=True)
        )
        at_risk = []
        for sub in active_subs.select_related('member__user'):
            if sub.member_id in recent_attendee_ids:
                continue
            last = (
                Attendance.objects.filter(member_id=sub.member_id)
                .order_by('-check_in_time')
                .values_list('check_in_time', flat=True)
                .first()
            )
            at_risk.append({
                'member_id': sub.member_id,
                'full_name': sub.member.user.full_name,
                'phone': sub.member.user.phone,
                'last_check_in': last.date() if last else None,
                'days_since': (today - last.date()).days if last else None,
            })
        at_risk.sort(key=lambda r: (r['days_since'] is None, -(r['days_since'] or 0)))

        # ---- Per-class performance ------------------------------------------
        # Same reason as above: capacity per class comes from its own
        # grouped query and is merged in by id.
        capacity_by_class = dict(
            past_sessions.values('gym_class_id')
            .annotate(c=Sum('capacity'))
            .values_list('gym_class_id', 'c')
        )
        class_rows = (
            GymClass.objects.filter(organization=org)
            .annotate(
                bookings=Count(
                    'sessions__bookings',
                    filter=Q(sessions__in=past_sessions, sessions__bookings__status=Booking.Status.CONFIRMED),
                    distinct=True,
                ),
                attendance=Count('sessions__attendances', filter=Q(sessions__in=past_sessions), distinct=True),
            )
            .order_by('-bookings')
        )
        class_performance = [
            {
                'name': row.name,
                'category': row.category,
                'bookings': row.bookings or 0,
                'attendance': row.attendance or 0,
                'capacity': capacity_by_class.get(row.id, 0),
                'attendance_rate': _pct(row.attendance or 0, row.bookings or 0),
                'fill_rate': _pct(row.bookings or 0, capacity_by_class.get(row.id, 0)),
            }
            for row in class_rows
        ]

        return Response({
            'window_days': self.WINDOW_DAYS,
            'kpis': {
                'active_members': active_members,
                'total_members': member_users.count(),
                'new_members': new_members,
                'attendance_rate': _pct(total_attendance, total_bookings),
                'fill_rate': _pct(total_bookings, total_capacity),
                'churn_rate': _pct(ended, churn_base),
                'churned': ended,
                'revenue': revenue_window,
                'arpu': round(float(revenue_window) / active_members) if active_members else 0,
                'expiring_soon': expiring.count(),
                'at_risk_count': len(at_risk),
            },
            'at_risk_members': at_risk[:15],
            'expiring_subscriptions': [
                {
                    'member_name': s.member.user.full_name,
                    'plan_name': s.plan.name,
                    'end_date': s.end_date,
                    'days_left': (s.end_date - today).days,
                }
                for s in expiring[:15]
            ],
            'class_performance': class_performance,
        })
