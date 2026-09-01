"""
Views for the blog app.

Admin and trainers write posts (competition reports, news, general
content); every authenticated user in the gym reads published ones —
admins/trainers additionally see their own unpublished drafts.
"""

from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from common.permissions import IsAdminOrTrainer

from .models import BlogPost
from .serializers import BlogPostSerializer


class BlogPostListCreateView(generics.ListCreateAPIView):
    serializer_class = BlogPostSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminOrTrainer()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = BlogPost.objects.filter(organization=user.organization).select_related('author')
        if user.is_admin_role or user.is_trainer:
            return qs
        return qs.filter(is_published=True)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, author=self.request.user)


class BlogPostDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BlogPostSerializer
    lookup_field = 'slug'

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [IsAdminOrTrainer()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = BlogPost.objects.filter(organization=user.organization).select_related('author')
        if user.is_admin_role or user.is_trainer:
            return qs
        return qs.filter(is_published=True)
