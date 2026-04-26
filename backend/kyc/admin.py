from django.contrib import admin
from .models import UserProfile, KYCSubmission, Document, Notification


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "role"]
    list_filter = ["role"]


@admin.register(KYCSubmission)
class KYCSubmissionAdmin(admin.ModelAdmin):
    list_display = ["id", "merchant", "status", "business_name", "created_at", "submitted_at"]
    list_filter = ["status"]
    search_fields = ["merchant__username", "business_name", "full_name"]
    readonly_fields = ["created_at", "updated_at", "submitted_at"]


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ["id", "submission", "doc_type", "original_filename", "file_size", "uploaded_at"]
    list_filter = ["doc_type"]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["id", "merchant", "event_type", "timestamp"]
    list_filter = ["event_type"]
    readonly_fields = ["timestamp"]
