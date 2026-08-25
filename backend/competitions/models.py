"""
Models for the competitions app: gym-run events/challenges members can join.

These are manually curated by the gym's admin (no automatic ranking or
scoring) — a competition is really "an announced event with a join button",
matching how a small gym would actually run a 30-day challenge or a
powerlifting meet: sign-ups happen here, the actual judging happens in
person.
"""

from django.db import models


class Competition(models.Model):
    class Kind(models.TextChoices):
        INDIVIDUAL = 'INDIVIDUAL', 'فردی'
        TEAM = 'TEAM', 'تیمی'

    class Level(models.TextChoices):
        ALL = 'ALL', 'همه سطوح'
        BEGINNER = 'BEGINNER', 'مبتدی'
        INTERMEDIATE = 'INTERMEDIATE', 'متوسط'
        ADVANCED = 'ADVANCED', 'پیشرفته'

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE, related_name='competitions'
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.INDIVIDUAL)
    level = models.CharField(max_length=15, choices=Level.choices, default=Level.ALL)
    image = models.ImageField(upload_to='competitions/', null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return self.title


class CompetitionPrize(models.Model):
    """A single prize tier (e.g. "نفر اول" — gold medal + cash)."""

    competition = models.ForeignKey(
        Competition, on_delete=models.CASCADE, related_name='prizes'
    )
    rank = models.PositiveIntegerField(help_text='1 = اول, 2 = دوم, ...')
    title = models.CharField(max_length=150)

    class Meta:
        ordering = ['rank']
        unique_together = ('competition', 'rank')

    def __str__(self):
        return f'{self.competition.title} - #{self.rank}: {self.title}'


class CompetitionParticipant(models.Model):
    """A member who has joined a competition (FR-style sign-up record)."""

    competition = models.ForeignKey(
        Competition, on_delete=models.CASCADE, related_name='participants'
    )
    member = models.ForeignKey(
        'accounts.Member', on_delete=models.CASCADE, related_name='competition_entries'
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('competition', 'member')
        ordering = ['joined_at']

    def __str__(self):
        return f'{self.member.user.full_name} -> {self.competition.title}'
