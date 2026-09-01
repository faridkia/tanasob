"""URL routes for the blog app (mounted under /api/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('blog/', views.BlogPostListCreateView.as_view(), name='blog-list'),
    # Persian slugs are non-ASCII, which Django's built-in `slug` converter
    # rejects (it only matches [-a-zA-Z0-9_]+) — `str` accepts anything but
    # a literal '/', which is exactly what we need here.
    path('blog/<str:slug>/', views.BlogPostDetailView.as_view(), name='blog-detail'),
]
