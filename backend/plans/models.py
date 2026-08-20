"""
Models for the plans app: workout plans with exercise items and diet plans
with meal items.

Mapping to the SRS data model: WorkoutPlan (6.12), WorkoutPlanItem (6.13),
DietPlan (6.14), DietPlanItem (6.15).
"""

from django.db import models


class WorkoutPlan(models.Model):
    """A training plan created by a Trainer for a Member (SRS 6.12)."""

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


class WorkoutPlanItem(models.Model):
    """A single exercise entry within a WorkoutPlan (SRS 6.13)."""

    workout_plan = models.ForeignKey(
        WorkoutPlan, on_delete=models.CASCADE, related_name='items'
    )
    exercise_name = models.CharField(max_length=200)
    sets = models.PositiveIntegerField()
    reps = models.PositiveIntegerField()
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.exercise_name}: {self.sets}x{self.reps}'


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
