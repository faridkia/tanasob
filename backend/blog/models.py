"""
Models for the blog app: gym-authored articles — competition reports
(results, photos, recap), general fitness content, and news — written by
an admin or trainer and shown to everyone in the gym.
"""

from django.db import models
from django.utils.html import strip_tags
from django.utils.text import slugify


class BlogPost(models.Model):
    class Category(models.TextChoices):
        COMPETITION_REPORT = 'COMPETITION_REPORT', 'گزارش مسابقه'
        NEWS = 'NEWS', 'اخبار باشگاه'
        GENERAL = 'GENERAL', 'عمومی'

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE, related_name='blog_posts'
    )
    author = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, related_name='blog_posts'
    )
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, blank=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.GENERAL)
    cover_image = models.ImageField(upload_to='blog/', null=True, blank=True)
    video_url = models.URLField(blank=True)
    content = models.TextField(blank=True)
    # Rich version of `content`, written in the WYSIWYG editor so a post can
    # carry images between its paragraphs. `content` stays as the plain-text
    # excerpt used on cards. Sanitised on write (common.richtext).
    content_html = models.TextField(blank=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('organization', 'slug')

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        # `content` is the plain-text excerpt shown on cards and in search.
        # Derive it from the rich body so an author writing only in the
        # editor never has to maintain two copies of the same text.
        if self.content_html and not self.content.strip():
            self.content = strip_tags(self.content_html).strip()[:400]
        if not self.slug:
            base = slugify(self.title, allow_unicode=True) or 'post'
            slug = base
            n = 1
            while BlogPost.objects.filter(organization=self.organization, slug=slug).exclude(pk=self.pk).exists():
                n += 1
                slug = f'{base}-{n}'
            self.slug = slug
        super().save(*args, **kwargs)
