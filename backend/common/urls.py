"""URL routes for shared/common endpoints (mounted under /api/)."""

from django.urls import path

from .uploads import EditorImageUploadView

urlpatterns = [
    path('editor/upload/', EditorImageUploadView.as_view(), name='editor-image-upload'),
]
