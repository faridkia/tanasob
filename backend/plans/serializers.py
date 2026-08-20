"""Serializers for the plans app."""

from rest_framework import serializers

from .models import DietPlan, DietPlanItem, WorkoutPlan, WorkoutPlanItem


# ---- Workout Plan ----

class WorkoutPlanItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutPlanItem
        fields = ('id', 'exercise_name', 'sets', 'reps', 'notes')
        read_only_fields = ('id',)


class WorkoutPlanSerializer(serializers.ModelSerializer):
    items = WorkoutPlanItemSerializer(many=True)
    trainer_name = serializers.CharField(source='trainer.user.full_name', read_only=True)
    member_name = serializers.CharField(source='member.user.full_name', read_only=True)

    class Meta:
        model = WorkoutPlan
        fields = (
            'id', 'member', 'member_name', 'trainer', 'trainer_name',
            'title', 'start_date', 'end_date', 'is_archived',
            'items', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'trainer', 'created_at', 'updated_at')

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        plan = WorkoutPlan.objects.create(**validated_data)
        for item in items_data:
            WorkoutPlanItem.objects.create(workout_plan=plan, **item)
        return plan

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                WorkoutPlanItem.objects.create(workout_plan=instance, **item)
        return instance


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
        extra_kwargs = {'image': {'required': True}}
