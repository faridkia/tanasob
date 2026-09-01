"""Serializers for the blog app."""

from rest_framework import serializers

from common.richtext import sanitize_html

from .models import BlogPost


class BlogPostSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.full_name', read_only=True)

    class Meta:
        model = BlogPost
        fields = (
            'id', 'title', 'slug', 'category', 'cover_image', 'video_url',
            'content', 'content_html', 'is_published', 'author_name', 'created_at',
        )
        read_only_fields = ('id', 'slug', 'author_name', 'created_at')
        # Derived from content_html on save, so the author only ever writes
        # in the editor.
        extra_kwargs = {'content': {'required': False}}

    def validate_content_html(self, value):
        return sanitize_html(value)
