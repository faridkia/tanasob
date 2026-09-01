"""
Serializers for the accounts app.

``RegisterSerializer`` creates a new user (and, via signals, the matching
profile). The other serializers expose user/profile data for the API.
"""

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from organizations.models import Organization

from common.richtext import sanitize_html

from .models import Member, Trainer, TrainerMemberAssignment, User


class OrganizationMiniSerializer(serializers.ModelSerializer):
    """Minimal org info nested inside UserSerializer (sidebar branding, etc.)."""

    class Meta:
        model = Organization
        fields = ('id', 'name', 'slug', 'logo')


class MemberProfileSerializer(serializers.ModelSerializer):
    has_face = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = ('date_of_birth', 'gender', 'address', 'has_face', 'show_on_leaderboard')

    def get_has_face(self, obj):
        return bool(obj.face_descriptor)


class TrainerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trainer
        fields = ('specialization', 'bio', 'bio_html', 'photo', 'experience_years')


class TrainerListSerializer(serializers.ModelSerializer):
    """Minimal trainer roster for admin pickers (e.g. assigning a session)."""

    full_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = Trainer
        fields = ('id', 'full_name', 'specialization', 'photo')


class MemberListSerializer(serializers.ModelSerializer):
    """Minimal member roster for admin pickers (e.g. assigning a trainer)."""

    full_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = Member
        fields = ('id', 'full_name')


class UserSerializer(serializers.ModelSerializer):
    """Read serializer for a user, including the role-specific profile."""

    member = MemberProfileSerializer(source='member_profile', read_only=True)
    trainer = TrainerProfileSerializer(source='trainer_profile', read_only=True)
    organization = OrganizationMiniSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'full_name',
            'phone',
            'role',
            'is_active',
            'created_at',
            'member',
            'trainer',
            'organization',
            'is_profile_public',
        )
        read_only_fields = ('id', 'role', 'is_active', 'created_at')


class RegisterSerializer(serializers.ModelSerializer):
    """Creates a new Member or Trainer account (FR-AUTH-1, FR-AUTH-2).

    The profile is created automatically by the post_save signal in
    ``accounts.signals``.
    """

    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)
    role = serializers.ChoiceField(
        choices=[User.Role.MEMBER, User.Role.TRAINER], default=User.Role.MEMBER
    )
    # Which gym this account is joining. Required for self-registration;
    # AdminUserListCreateView overrides it server-side to the creating
    # admin's own org, and RegisterOrganizationView sets it after the
    # Organization itself is created (see organizations.serializers).
    organization = serializers.PrimaryKeyRelatedField(
        queryset=Organization.objects.filter(is_active=True), required=True
    )

    # Optional profile fields accepted at registration.
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    specialization = serializers.CharField(required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    experience_years = serializers.IntegerField(required=False, default=0)

    class Meta:
        model = User
        fields = (
            'email',
            'full_name',
            'phone',
            'password',
            'password2',
            'role',
            'organization',
            'date_of_birth',
            'gender',
            'address',
            'specialization',
            'bio',
            'experience_years',
        )

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value.lower()

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password2': 'Passwords do not match.'})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        profile_fields = {
            'date_of_birth': validated_data.pop('date_of_birth', None),
            'gender': validated_data.pop('gender', ''),
            'address': validated_data.pop('address', ''),
            'specialization': validated_data.pop('specialization', ''),
            'bio': validated_data.pop('bio', ''),
            'experience_years': validated_data.pop('experience_years', 0),
        }
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()  # signal creates the Member/Trainer profile

        # Fill in the profile fields that were supplied at registration.
        if user.role == User.Role.MEMBER and hasattr(user, 'member_profile'):
            profile = user.member_profile
            profile.date_of_birth = profile_fields['date_of_birth']
            profile.gender = profile_fields['gender']
            profile.address = profile_fields['address']
            profile.save()
        elif user.role == User.Role.TRAINER and hasattr(user, 'trainer_profile'):
            profile = user.trainer_profile
            profile.specialization = profile_fields['specialization']
            profile.bio = profile_fields['bio']
            profile.experience_years = profile_fields['experience_years']
            profile.save()
        return user


class LoginSerializer(serializers.Serializer):
    """Validates credentials. The view issues JWT tokens on success (FR-AUTH-2)."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get('email').lower()
        password = attrs.get('password')
        user = authenticate(request=self.context.get('request'), username=email, password=password)
        if not user:
            raise serializers.ValidationError('Invalid email or password.')
        if not user.is_active:
            raise serializers.ValidationError('This account is disabled.')
        attrs['user'] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """Admin-only edit: name/phone and activate/deactivate (FR-AUTH-5)."""

    class Meta:
        model = User
        fields = ('full_name', 'phone', 'is_active')


class TrainerMemberAssignmentSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.user.full_name', read_only=True)
    trainer_name = serializers.CharField(source='trainer.user.full_name', read_only=True)
    member_user_id = serializers.IntegerField(source='member.user.id', read_only=True)
    trainer_user_id = serializers.IntegerField(source='trainer.user.id', read_only=True)

    class Meta:
        model = TrainerMemberAssignment
        fields = (
            'id',
            'member',
            'trainer',
            'member_name',
            'trainer_name',
            'member_user_id',
            'trainer_user_id',
            'status',
            'assigned_at',
        )
        read_only_fields = (
            'id',
            'assigned_at',
            'member_name',
            'trainer_name',
            'member_user_id',
            'trainer_user_id',
        )


class UpdateProfileSerializer(serializers.ModelSerializer):
    """Lets a user update their own profile info (FR-AUTH-4)."""

    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    specialization = serializers.CharField(required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    bio_html = serializers.CharField(required=False, allow_blank=True)
    experience_years = serializers.IntegerField(required=False)
    show_on_leaderboard = serializers.BooleanField(required=False)

    class Meta:
        model = User
        fields = (
            'full_name',
            'phone',
            'is_profile_public',
            'date_of_birth',
            'gender',
            'address',
            'show_on_leaderboard',
            'specialization',
            'bio',
            'bio_html',
            'experience_years',
        )

    def validate_bio_html(self, value):
        # Runs on every write path, so HTML posted straight at the API is
        # cleaned exactly like HTML that came from the editor.
        return sanitize_html(value)

    def update(self, instance, validated_data):
        profile_keys = (
            'date_of_birth',
            'gender',
            'address',
            'show_on_leaderboard',
            'specialization',
            'bio',
            'bio_html',
            'experience_years',
        )
        profile_data = {k: validated_data.pop(k) for k in profile_keys if k in validated_data}
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()

        if instance.role == User.Role.MEMBER and hasattr(instance, 'member_profile'):
            profile = instance.member_profile
            for key, value in profile_data.items():
                if key in ('date_of_birth', 'gender', 'address', 'show_on_leaderboard'):
                    setattr(profile, key, value)
            profile.save()
        elif instance.role == User.Role.TRAINER and hasattr(instance, 'trainer_profile'):
            profile = instance.trainer_profile
            for key, value in profile_data.items():
                if key in ('specialization', 'bio', 'bio_html', 'experience_years'):
                    setattr(profile, key, value)
            profile.save()
        return instance
