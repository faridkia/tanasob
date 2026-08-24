from django.utils.text import slugify
from rest_framework import serializers

from accounts.models import User
from accounts.serializers import RegisterSerializer

from .models import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    """Public read serializer — feeds the "join a gym" picker at registration."""

    class Meta:
        model = Organization
        fields = ('id', 'name', 'slug', 'logo', 'address')


class RegisterOrganizationSerializer(serializers.ModelSerializer):
    """Creates a new Organization for the "register your gym" flow.

    The first ADMIN user is created separately (in the view, reusing
    RegisterSerializer's user-creation logic) inside the same transaction.
    """

    class Meta:
        model = Organization
        fields = ('name', 'address', 'phone')

    def validate_name(self, value):
        if Organization.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError('باشگاهی با این نام قبلاً ثبت شده است.')
        return value

    def create(self, validated_data):
        base_slug = slugify(validated_data['name'], allow_unicode=True) or 'gym'
        slug = base_slug
        n = 1
        while Organization.objects.filter(slug=slug).exists():
            n += 1
            slug = f'{base_slug}-{n}'
        return Organization.objects.create(slug=slug, **validated_data)


class RegisterOrgAdminSerializer(RegisterSerializer):
    """RegisterSerializer variant for the "register your gym" flow: the
    account being created is always the gym's first ADMIN, and its
    organization isn't known until the Organization is created in the same
    request (see RegisterOrganizationView), so it's set programmatically
    afterwards rather than required up front."""

    role = serializers.ChoiceField(choices=[User.Role.ADMIN], default=User.Role.ADMIN)
    organization = serializers.PrimaryKeyRelatedField(queryset=Organization.objects.all(), required=False)
