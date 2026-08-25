"""
Models for the plans app: workout plans with exercise items and diet plans
with meal items.

Mapping to the SRS data model: WorkoutPlan (6.12), WorkoutPlanItem (6.13),
DietPlan (6.14), DietPlanItem (6.15).
"""

from django.db import models


class WorkoutPlan(models.Model):

    member = models.ForeignKey(
        'accounts.Member', on_delete=models.CASCADE, related_name='workout_plans'
    )
    trainer = models.ForeignKey(
        'accounts.Trainer', on_delete=models.CASCADE, related_name='workout_plans'
    )
    title = models.CharField(max_length=200)
    start_date = models.DateField()
    end_date = models.DateField()
    is_archived = models.BooleanField(default=False)
    # Optional reference photo (e.g. a form check or equipment setup),
    # uploaded separately via WorkoutPlanImageUploadView — mirrors DietPlan.
    image = models.ImageField(upload_to='workout_plans/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Workout: {self.title} for {self.member.user.full_name}'


class Exercise(models.Model):
    """A single reusable exercise definition, optionally with a tutorial video.

    ``organization=None`` means a shared/global library exercise (seeded
    once, visible to every gym); a set organization means one gym's own
    custom addition, visible only there.
    """

    class MuscleGroup(models.TextChoices):
        CHEST = 'CHEST', 'سینه'
        BACK = 'BACK', 'پشت'
        LEGS = 'LEGS', 'پا'
        SHOULDERS = 'SHOULDERS', 'شانه'
        ARMS = 'ARMS', 'بازو'
        CORE = 'CORE', 'شکم'
        CARDIO = 'CARDIO', 'هوازی'
        FULL_BODY = 'FULL_BODY', 'کل بدن'

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='exercises',
    )
    name = models.CharField(max_length=150)
    muscle_group = models.CharField(
        max_length=20, choices=MuscleGroup.choices, default=MuscleGroup.FULL_BODY
    )
    # A link to a YouTube/Aparat tutorial — embedded in the frontend, not a
    # hosted file (self-hosting video is out of scope for a capstone VPS).
    video_url = models.URLField(blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class WorkoutDay(models.Model):
    """One day within a day-split workout plan, pinned to a real calendar
    date (e.g. "May 12 — Push Day") so members see it on an actual
    calendar instead of an abstract "Day 1/Day 2" sequence."""

    workout_plan = models.ForeignKey(
        WorkoutPlan, on_delete=models.CASCADE, related_name='days'
    )
    date = models.DateField()
    label = models.CharField(max_length=100, blank=True)

    class Meta:
        unique_together = ('workout_plan', 'date')
        ordering = ['date']

    def __str__(self):
        return f'{self.workout_plan.title} - {self.date} ({self.label})'


class WorkoutPlanItem(models.Model):
    """A single exercise entry within a WorkoutDay (SRS 6.13)."""

    day = models.ForeignKey(
        WorkoutDay, on_delete=models.CASCADE, related_name='items',
    )
    exercise = models.ForeignKey(
        Exercise, on_delete=models.PROTECT, related_name='plan_items',
    )
    sets = models.PositiveIntegerField()
    reps = models.PositiveIntegerField()
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.exercise.name}: {self.sets}x{self.reps}'


class DietPlan(models.Model):
    """A nutrition plan created by a Trainer for a Member (SRS 6.14)."""

    member = models.ForeignKey(
        'accounts.Member', on_delete=models.CASCADE, related_name='diet_plans'
    )
    trainer = models.ForeignKey(
        'accounts.Trainer', on_delete=models.CASCADE, related_name='diet_plans'
    )
    title = models.CharField(max_length=200)
    start_date = models.DateField()
    end_date = models.DateField()
    is_archived = models.BooleanField(default=False)
    # A reference photo the trainer can attach (e.g. a plated meal or a
    # hand-written diet chart) — optional, uploaded separately from the
    # rest of the plan via DietPlanImageUploadView.
    image = models.ImageField(upload_to='diet_plans/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Diet: {self.title} for {self.member.user.full_name}'


class DietPlanItem(models.Model):
    """A single meal entry within a DietPlan (SRS 6.15)."""

    diet_plan = models.ForeignKey(
        DietPlan, on_delete=models.CASCADE, related_name='items'
    )
    meal_name = models.CharField(max_length=100)  # e.g. Breakfast, Lunch
    calories = models.PositiveIntegerField()
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.meal_name} ({self.calories} cal)'
