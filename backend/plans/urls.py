"""URL routes for the plans app (mounted under /api/)."""

from django.urls import path

from . import views

urlpatterns = [
    path('exercises/', views.ExerciseListCreateView.as_view(), name='exercise-list'),
    path('exercises/<int:pk>/', views.ExerciseDetailView.as_view(), name='exercise-detail'),
    path('workout-plans/', views.WorkoutPlanListCreateView.as_view(), name='workoutplan-list'),
    path('workout-plans/<int:pk>/', views.WorkoutPlanDetailView.as_view(), name='workoutplan-detail'),
    path('workout-plans/<int:pk>/archive/', views.ArchiveWorkoutPlanView.as_view(), name='workoutplan-archive'),
    path('workout-plans/<int:pk>/image/', views.WorkoutPlanImageUploadView.as_view(), name='workoutplan-image'),
    path('diet-plans/', views.DietPlanListCreateView.as_view(), name='dietplan-list'),
    path('diet-plans/<int:pk>/', views.DietPlanDetailView.as_view(), name='dietplan-detail'),
    path('diet-plans/<int:pk>/archive/', views.ArchiveDietPlanView.as_view(), name='dietplan-archive'),
    path('diet-plans/<int:pk>/image/', views.DietPlanImageUploadView.as_view(), name='dietplan-image'),
]
