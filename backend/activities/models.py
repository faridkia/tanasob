"""
Models for the activities app: logged workout sessions and GPS-tracked
walks/runs, used to chart calories burned and time spent training.

Calories are computed client-side (standard MET formula using the member's
latest logged body weight) and submitted as a finished summary — there's no
server-side simulation of the session itself, just a record of what
happened.
"""

from django.db import models


class ActivityLog(models.Model):

    class ActivityType(models.TextChoices):
        WORKOUT = 'WORKOUT', 'برنامه تمرینی'
        WALK = 'WALK', 'پیاده‌روی'
        RUN = 'RUN', 'دویدن'

    member = models.ForeignKey(
        'accounts.Member', on_delete=models.CASCADE, related_name='activity_logs'
    )
    activity_type = models.CharField(max_length=10, choices=ActivityType.choices)
    workout_plan = models.ForeignKey(
        'plans.WorkoutPlan', on_delete=models.SET_NULL, null=True, blank=True, related_name='activity_logs'
    )
    # Which scheduled day this session completed. Without it the server only
    # knows "some workout from this plan finished" and cannot tell a session
    # done on its due date from one claimed a week early.
    workout_day = models.ForeignKey(
        'plans.WorkoutDay', on_delete=models.SET_NULL, null=True, blank=True, related_name='activity_logs'
    )
    duration_seconds = models.PositiveIntegerField()
    calories_burned = models.PositiveIntegerField()
    distance_km = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.member.user.full_name} - {self.get_activity_type_display()} ({self.calories_burned} kcal)'
