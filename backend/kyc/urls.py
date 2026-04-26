"""
URL configuration for the KYC API.
All endpoints live under /api/v1/.
"""

from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"submissions", views.SubmissionViewSet, basename="submission")
router.register(r"queue", views.ReviewQueueViewSet, basename="queue")

urlpatterns = [
    # Auth
    path("auth/register/", views.register_view, name="register"),
    path("auth/login/", views.login_view, name="login"),
    path("auth/me/", views.me_view, name="me"),
] + router.urls
