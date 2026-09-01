"""Serializers for the bookings app."""

from rest_framework import serializers

from .models import Attendance, Booking


class BookingSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.user.full_name', read_only=True)
    session_detail = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            'id',
            'member',
            'member_name',
            'session',
            'session_detail',
            'status',
            'booked_at',
        )
        read_only_fields = ('id', 'member', 'status', 'booked_at', 'member_name', 'session_detail')

    def get_session_detail(self, obj):
        s = obj.session
        return {
            'id': s.id,
            'gym_class': s.gym_class.name,
            # The ids, not just the display names: the calendar links straight
            # through to the class and trainer pages, and a name is not
            # something you can build a URL from.
            'gym_class_id': s.gym_class_id,
            'trainer': s.trainer.user.full_name,
            'trainer_id': s.trainer_id,
            'session_date': s.session_date,
            'start_time': s.start_time,
            'end_time': s.end_time,
        }


class AttendanceSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.user.full_name', read_only=True)
    session_detail = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = (
            'id',
            'member',
            'member_name',
            'session',
            'session_detail',
            'check_in_time',
        )
        read_only_fields = ('id', 'check_in_time', 'member_name', 'session_detail')

    def get_session_detail(self, obj):
        s = obj.session
        return {
            'id': s.id,
            'gym_class': s.gym_class.name,
            'gym_class_id': s.gym_class_id,
            'session_date': s.session_date,
            'start_time': s.start_time,
        }
