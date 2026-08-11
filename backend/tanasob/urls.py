"""
Root URL configuration for the Tanasob Smart Gym API.

All business endpoints live under the ``/api/`` prefix. Swagger UI is served
at ``/api/docs/``.
"""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),

    # API docs (Swagger)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path(
        'api/docs/',
        SpectacularSwaggerView.as_view(url_name='schema'),
        name='swagger-ui',
    ),

    # JWT refresh
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Business apps
    path('api/auth/', include('accounts.urls')),
    path('api/', include('memberships.urls')),
    path('api/', include('classes.urls')),
    path('api/', include('bookings.urls')),
    path('api/', include('plans.urls')),
    path('api/', include('progress.urls')),
    path('api/', include('messaging.urls')),
    path('api/', include('notifications.urls')),
    path('api/', include('reports.urls')),
]
