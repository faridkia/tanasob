"""
Views for the plans app.

Trainers create/update/archive workout and diet plans for their assigned
members (FR-PLAN-1..FR-PLAN-4). Members can view their own plans (FR-PLAN-3).
"""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdminOrTrainer, IsTrainer

from accounts.models import TrainerMemberAssignment

from .models import DietPlan, Exercise, WorkoutPlan
from .serializers import (
    DietPlanImageSerializer,
    DietPlanSerializer,
    ExerciseSerializer,
    WorkoutPlanImageSerializer,
    WorkoutPlanSerializer,
)


def _trainer_member_ids(trainer_user):
    """Return the set of member PKs assigned to this trainer."""
    return set(
        TrainerMemberAssignment.objects.filter(
            trainer__user=trainer_user, status='ACTIVE'
        ).values_list('member_id', flat=True)
    )


class ExerciseListCreateView(generics.ListCreateAPIView):
    """The exercise library: shared/global exercises plus the gym's own
    additions. Admin and trainer manage it; every authenticated user reads
    it (needed to render a plan's exercise names/videos)."""

    serializer_class = ExerciseSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminOrTrainer()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Exercise.objects.filter(
            Q(organization=self.request.user.organization) | Q(organization__isnull=True)
        )
        muscle_group = self.request.query_params.get('muscle_group')
        if muscle_group:
            qs = qs.filter(muscle_group=muscle_group)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search)
        return qs

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)


class ExerciseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExerciseSerializer
    permission_classes = [IsAdminOrTrainer]

    def get_queryset(self):
        # Trainers/admins may only edit their own gym's custom exercises —
        # the shared/global library (organization=None) is read-only here.
        return Exercise.objects.filter(organization=self.request.user.organization)


class WorkoutPlanListCreateView(generics.ListCreateAPIView):
    serializer_class = WorkoutPlanSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsTrainer()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = WorkoutPlan.objects.select_related('member__user', 'trainer__user')
        if user.is_trainer:
            return qs.filter(trainer__user=user)
        if user.is_member:
            return qs.filter(member=user.member_profile, is_archived=False)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        member = serializer.validated_data.get('member')
        if user.is_trainer and member and member.id not in _trainer_member_ids(user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only create plans for your assigned members.')
        serializer.save(trainer=user.trainer_profile)


class WorkoutPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = WorkoutPlanSerializer

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [IsTrainer()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = WorkoutPlan.objects.select_related('member__user', 'trainer__user')
        if user.is_trainer:
            return qs.filter(trainer__user=user)
        if user.is_member:
            return qs.filter(member=user.member_profile)
        return qs


class ArchiveWorkoutPlanView(APIView):
    permission_classes = [IsTrainer]

    def post(self, request, pk):
        plan = get_object_or_404(WorkoutPlan, pk=pk, trainer__user=request.user)
        plan.is_archived = True
        plan.save(update_fields=['is_archived'])
        return Response({'detail': 'Workout plan archived.'})


class WorkoutPlanImageUploadView(APIView):
    """Trainer attaches/replaces a reference photo on their own workout plan."""

    permission_classes = [IsTrainer]

    def post(self, request, pk):
        plan = get_object_or_404(WorkoutPlan, pk=pk, trainer__user=request.user)
        serializer = WorkoutPlanImageSerializer(plan, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(WorkoutPlanSerializer(plan, context={'request': request}).data)


class DietPlanListCreateView(generics.ListCreateAPIView):
    serializer_class = DietPlanSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsTrainer()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = DietPlan.objects.select_related('member__user', 'trainer__user')
        if user.is_trainer:
            return qs.filter(trainer__user=user)
        if user.is_member:
            return qs.filter(member=user.member_profile, is_archived=False)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        member = serializer.validated_data.get('member')
        if user.is_trainer and member and member.id not in _trainer_member_ids(user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only create plans for your assigned members.')
        serializer.save(trainer=user.trainer_profile)


class DietPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DietPlanSerializer

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [IsTrainer()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = DietPlan.objects.select_related('member__user', 'trainer__user')
        if user.is_trainer:
            return qs.filter(trainer__user=user)
        if user.is_member:
            return qs.filter(member=user.member_profile)
        return qs


class ArchiveDietPlanView(APIView):
    permission_classes = [IsTrainer]

    def post(self, request, pk):
        plan = get_object_or_404(DietPlan, pk=pk, trainer__user=request.user)
        plan.is_archived = True
        plan.save(update_fields=['is_archived'])
        return Response({'detail': 'Diet plan archived.'})


class DietPlanImageUploadView(APIView):
    """Trainer attaches/replaces a reference photo on their own diet plan."""

    permission_classes = [IsTrainer]

    def post(self, request, pk):
        plan = get_object_or_404(DietPlan, pk=pk, trainer__user=request.user)
        serializer = DietPlanImageSerializer(plan, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(DietPlanSerializer(plan, context={'request': request}).data)
