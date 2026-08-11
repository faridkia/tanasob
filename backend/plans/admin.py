from django.contrib import admin

from .models import DietPlan, DietPlanItem, WorkoutPlan, WorkoutPlanItem


admin.site.register(DietPlan)
admin.site.register(DietPlanItem)
admin.site.register(WorkoutPlan)
admin.site.register(WorkoutPlanItem)
