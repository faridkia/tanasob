"""
Image upload endpoint backing the rich-text editor.

The editor needs somewhere to PUT an image the moment it is dropped into a
description, and to get a URL back. Restricted to admins and trainers —
they are the only roles that can write rich text at all.
"""

import uuid

from django.core.files.storage import default_storage
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdminOrTrainer

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
# Checked against the real decoded image, not the filename or the
# client-supplied content type — both are trivially forged.
ALLOWED_FORMATS = {'JPEG', 'PNG', 'WEBP', 'GIF'}
EXTENSION_FOR_FORMAT = {'JPEG': 'jpg', 'PNG': 'png', 'WEBP': 'webp', 'GIF': 'gif'}


class EditorImageUploadView(APIView):
    """POST an image, get back {url}. Used by the CKEditor upload adapter."""

    permission_classes = [IsAdminOrTrainer]
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get('upload') or request.FILES.get('image')
        if not upload:
            return Response({'error': {'message': 'فایلی ارسال نشد.'}}, status=status.HTTP_400_BAD_REQUEST)
        if upload.size > MAX_UPLOAD_BYTES:
            return Response(
                {'error': {'message': 'حجم عکس نباید بیشتر از ۵ مگابایت باشد.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify by decoding. A file called "x.png" that is actually an HTML
        # document would otherwise be served back from our own domain.
        from PIL import Image

        try:
            image = Image.open(upload)
            image.verify()
            image_format = (image.format or '').upper()
        except Exception:
            return Response(
                {'error': {'message': 'فایل ارسالی یک تصویر معتبر نیست.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if image_format not in ALLOWED_FORMATS:
            return Response(
                {'error': {'message': 'فقط JPG، PNG، WEBP و GIF پذیرفته می‌شود.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Name the file ourselves — never trust the uploaded filename, which
        # can carry path traversal or a second extension.
        extension = EXTENSION_FOR_FORMAT[image_format]
        name = f'editor/{uuid.uuid4().hex}.{extension}'
        upload.seek(0)
        saved_path = default_storage.save(name, upload)

        # Ask the storage backend for the URL rather than concatenating
        # MEDIA_URL, so this keeps working if storage ever moves off local
        # disk (S3, a CDN) without touching this view.
        return Response({'url': default_storage.url(saved_path)}, status=status.HTTP_201_CREATED)
