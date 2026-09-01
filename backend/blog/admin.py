from django.contrib import admin

from .models import BlogPost


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ('title', 'organization', 'category', 'author', 'is_published', 'created_at')
    list_filter = ('organization', 'category', 'is_published')
    prepopulated_fields = {'slug': ('title',)}
