"""
Views for the events app.

Admin creates/edits/deletes events; any authenticated user in the gym sees
the org's events (this feeds the dashboard hero slider for every role).
"""

from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from common.permissions import IsAdmin

from .models import Event
from .serializers import EventSerializer


class EventListCreateView(generics.ListCreateAPIView):
    serializer_class = EventSerializer
    pagination_class = None

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return Event.objects.filter(organization=self.request.user.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)


class EventDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EventSerializer

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return Event.objects.filter(organization=self.request.user.organization)
