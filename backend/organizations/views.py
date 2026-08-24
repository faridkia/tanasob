from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.serializers import UserSerializer

from .models import Organization
from .serializers import (
    OrganizationSerializer,
    RegisterOrganizationSerializer,
    RegisterOrgAdminSerializer,
)


class OrganizationListView(generics.ListAPIView):
    """Public roster of active gyms — feeds the "join a gym" registration picker."""

    queryset = Organization.objects.filter(is_active=True)
    serializer_class = OrganizationSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class RegisterOrganizationView(APIView):
    """"Register your gym" flow: creates an Organization and its first ADMIN
    user together, in one transaction."""

    permission_classes = [AllowAny]

    def post(self, request):
        org_serializer = RegisterOrganizationSerializer(data=request.data)
        org_serializer.is_valid(raise_exception=True)

        user_serializer = RegisterOrgAdminSerializer(data=request.data)
        user_serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            organization = org_serializer.save()
            user = user_serializer.save()
            user.organization = organization
            user.save(update_fields=['organization'])

        from accounts.views import _tokens_for

        return Response(
            {
                'organization': OrganizationSerializer(organization).data,
                'user': UserSerializer(user).data,
                'tokens': _tokens_for(user),
            },
            status=status.HTTP_201_CREATED,
        )
