"""Views for the activities app."""

from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ActivityLog
from .serializers import ActivityLogSerializer
from .services import calorie_summary


class ActivityLogListCreateView(generics.ListCreateAPIView):
    """A member logs a finished workout session or GPS walk/run, and views
    their own history."""

    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ActivityLog.objects.filter(member=self.request.user.member_profile)

    def perform_create(self, serializer):
        serializer.save(member=self.request.user.member_profile)


class ActivitySummaryView(APIView):
    """Today's/this-week's calories burned + a 7-day chart — feeds the
    dashboard calorie card."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_member:
            return Response({'detail': 'Only members have an activity summary.'}, status=400)
        return Response(calorie_summary(request.user.member_profile))
