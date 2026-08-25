"""
Views for the competitions app.

Admin creates/edits/deletes competitions; any authenticated user in the gym
can view them; only members can join. Joining just records a sign-up — there
is no automatic ranking or scoring (judging happens in person at the gym).
"""

from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdmin

from .models import Competition, CompetitionParticipant
from .serializers import CompetitionSerializer


class CompetitionListCreateView(generics.ListCreateAPIView):
    serializer_class = CompetitionSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return Competition.objects.filter(
            organization=self.request.user.organization
        ).prefetch_related('prizes', 'participants')

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)


class CompetitionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CompetitionSerializer

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return Competition.objects.filter(
            organization=self.request.user.organization
        ).prefetch_related('prizes', 'participants')


class JoinCompetitionView(APIView):
    """Member signs up for a competition (idempotent)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not request.user.is_member:
            raise PermissionDenied('Only members can join a competition.')
        try:
            competition = Competition.objects.get(pk=pk, organization=request.user.organization)
        except Competition.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if not competition.is_active or competition.end_date < timezone.localdate():
            raise ValidationError('This competition is no longer accepting participants.')

        CompetitionParticipant.objects.get_or_create(
            competition=competition, member=request.user.member_profile
        )
        return Response(
            CompetitionSerializer(competition, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )
