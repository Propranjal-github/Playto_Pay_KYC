"""
Root URL configuration for the Playto KYC project.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

def root_view(request):
    return JsonResponse({
        "status": "online", 
        "message": "Playto KYC API is running. Please access endpoints via /api/v1/"
    })

urlpatterns = [
    path("", root_view),
    path("admin/", admin.site.urls),
    path("api/v1/", include("kyc.urls")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
