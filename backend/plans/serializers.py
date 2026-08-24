"""Serializers for the plans app."""

from rest_framework import serializers

from .models import DietPlan, DietPlanItem, Exercise, WorkoutDay, WorkoutPlan, WorkoutPlanItem

MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB — plenty for a phone photo, caps abuse


def validate_image_size(value):
    if value.size > MAX_IMAGE_SIZE_BYTES:
        raise serializers.ValidationError('حجم عکس نباید بیشتر از ۵ مگابایت باشد.')


# ---- Exercise library ----

class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = ('id', 'organization', 'name', 'muscle_group', 'video_url', 'description', 'created_at')
        read_only_fields = ('id', 'organization', 'created_at')


# ---- Workout Plan (day-split) ----

class WorkoutPlanItemSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(source='exercise.name', read_only=True)
    muscle_group = serializers.CharField(source='exercise.muscle_group', read_only=True)
    video_url = serializers.CharField(source='exercise.video_url', read_only=True)

    class Meta:
        model = WorkoutPlanItem
        fields = ('id', 'exercise', 'exercise_name', 'muscle_group', 'video_url', 'sets', 'reps', 'notes')
        read_only_fields = ('id',)


class WorkoutDaySerializer(serializers.ModelSerializer):
    items = WorkoutPlanItemSerializer(many=True)

    class Meta:
        model = WorkoutDay
        fields = ('id', 'day_number', 'label', 'items')
        read_only_fields = ('id',)


class WorkoutPlanSerializer(serializers.ModelSerializer):
    days = WorkoutDaySerializer(many=True)
    trainer_name = serializers.CharField(source='trainer.user.full_name', read_only=True)
    member_name = serializers.CharField(source='member.user.full_name', read_only=True)

    class Meta:
        model = WorkoutPlan
        fields = (
            'id', 'member', 'member_name', 'trainer', 'trainer_name',
            'title', 'start_date', 'end_date', 'is_archived', 'image',
            'days', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'trainer', 'image', 'created_at', 'updated_at')

    def _create_days(self, plan, days_data):
        for day_data in days_data:
            items_data = day_data.pop('items')
            day = WorkoutDay.objects.create(workout_plan=plan, **day_data)
            for item in items_data:
                WorkoutPlanItem.objects.create(day=day, **item)

    def create(self, validated_data):
        days_data = validated_data.pop('days')
        plan = WorkoutPlan.objects.create(**validated_data)
        self._create_days(plan, days_data)
        return plan

    def update(self, instance, validated_data):
        days_data = validated_data.pop('days', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if days_data is not None:
            instance.days.all().delete()
            self._create_days(instance, days_data)
        return instance


class WorkoutPlanImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutPlan
        fields = ('image',)
        extra_kwargs = {'image': {'required': True, 'validators': [validate_image_size]}}


# ---- Diet Plan ----

class DietPlanItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DietPlanItem
        fields = ('id', 'meal_name', 'calories', 'description')
        read_only_fields = ('id',)


class DietPlanSerializer(serializers.ModelSerializer):
    items = DietPlanItemSerializer(many=True)
    trainer_name = serializers.CharField(source='trainer.user.full_name', read_only=True)
    member_name = serializers.CharField(source='member.user.full_name', read_only=True)

    class Meta:
        model = DietPlan
        fields = (
            'id', 'member', 'member_name', 'trainer', 'trainer_name',
            'title', 'start_date', 'end_date', 'is_archived', 'image',
            'items', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'trainer', 'image', 'created_at', 'updated_at')

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        plan = DietPlan.objects.create(**validated_data)
        for item in items_data:
            DietPlanItem.objects.create(diet_plan=plan, **item)
        return plan

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                DietPlanItem.objects.create(diet_plan=instance, **item)
        return instance


class DietPlanImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = DietPlan
        fields = ('image',)
        extra_kwargs = {'image': {'required': True, 'validators': [validate_image_size]}}
