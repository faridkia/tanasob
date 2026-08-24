"""
Reusable role-based permission classes used across all apps.

The custom ``User`` model exposes three roles (MEMBER, TRAINER, ADMIN) via the
``is_member``, ``is_trainer`` and ``is_admin`` helpers. These permission classes
implement the role-based authorization required by NFR-3.
"""

from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """Allow access only to ADMIN users."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin_role)


class IsTrainer(permissions.BasePermission):
    """Allow access only to TRAINER users."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_trainer)


class IsMember(permissions.BasePermission):
    """Allow access only to MEMBER users."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_member)


class IsAdminOrTrainer(permissions.BasePermission):
    """Allow access to ADMIN and TRAINER users (e.g. managing the exercise library)."""

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and (request.user.is_admin_role or request.user.is_trainer)
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """Admins can do everything; other authenticated users can only read."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_admin_role


class ReadOnly(permissions.BasePermission):
    """Allow only safe (GET/HEAD/OPTIONS) methods."""

    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS
