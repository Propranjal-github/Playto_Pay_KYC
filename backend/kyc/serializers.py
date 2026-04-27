"""
DRF Serializers for the KYC Pipeline.
"""

from django.utils import timezone

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import KYCSubmission, Document, Notification, UserProfile
from .validators import validate_document_file
from .state_machine import get_allowed_transitions


# --- Auth Serializers ---


class RegisterSerializer(serializers.Serializer):
    """Handles user registration with role."""

    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=["merchant", "reviewer"])

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
        )
        UserProfile.objects.create(user=user, role=validated_data["role"])
        return user


class LoginSerializer(serializers.Serializer):
    """Handles user login."""

    username = serializers.CharField()
    password = serializers.CharField()


# --- Document Serializer ---


class DocumentSerializer(serializers.ModelSerializer):
    """Serializer for uploaded documents."""

    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "doc_type",
            "original_filename",
            "file_size",
            "mime_type",
            "uploaded_at",
            "file_url",
        ]
        read_only_fields = [
            "id",
            "original_filename",
            "file_size",
            "mime_type",
            "uploaded_at",
            "file_url",
        ]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class DocumentUploadSerializer(serializers.Serializer):
    """Handles document upload with validation."""

    file = serializers.FileField()
    doc_type = serializers.ChoiceField(
        choices=["pan", "aadhaar", "bank_statement"]
    )

    def validate_file(self, value):
        validate_document_file(value)
        return value


# --- KYC Submission Serializers ---


class KYCSubmissionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing submissions."""

    merchant_name = serializers.CharField(
        source="merchant.username", read_only=True
    )
    reviewer_name = serializers.CharField(
        source="reviewer.username", read_only=True, default=None
    )
    document_count = serializers.IntegerField(read_only=True)
    is_at_risk = serializers.BooleanField(read_only=True, required=False)
    hours_in_queue = serializers.SerializerMethodField()
    allowed_transitions = serializers.SerializerMethodField()

    class Meta:
        model = KYCSubmission
        fields = [
            "id",
            "merchant_name",
            "reviewer_name",
            "status",
            "full_name",
            "business_name",
            "created_at",
            "submitted_at",
            "updated_at",
            "document_count",
            "is_at_risk",
            "hours_in_queue",
            "allowed_transitions",
        ]

    def get_allowed_transitions(self, obj):
        return get_allowed_transitions(obj.status)

    def get_hours_in_queue(self, obj):
        if obj.submitted_at:
            delta = timezone.now() - obj.submitted_at
            return round(delta.total_seconds() / 3600, 1)
        return 0


class KYCSubmissionDetailSerializer(serializers.ModelSerializer):
    """Full serializer for submission detail view."""

    merchant_name = serializers.CharField(
        source="merchant.username", read_only=True
    )
    documents = DocumentSerializer(many=True, read_only=True)
    allowed_transitions = serializers.SerializerMethodField()
    is_at_risk = serializers.BooleanField(read_only=True, required=False)
    hours_in_queue = serializers.SerializerMethodField()

    class Meta:
        model = KYCSubmission
        fields = [
            "id",
            "merchant_name",
            "status",
            # Personal details
            "full_name",
            "email",
            "phone",
            # Business details
            "business_name",
            "business_type",
            "monthly_volume_usd",
            # Review
            "reviewer",
            "review_reason",
            # Documents
            "documents",
            # Timestamps
            "created_at",
            "submitted_at",
            "updated_at",
            # Computed
            "allowed_transitions",
            "is_at_risk",
            "hours_in_queue",
        ]
        read_only_fields = [
            "id",
            "status",
            "merchant_name",
            "reviewer",
            "review_reason",
            "created_at",
            "submitted_at",
            "updated_at",
            "documents",
            "allowed_transitions",
            "is_at_risk",
            "hours_in_queue",
        ]

    def get_allowed_transitions(self, obj):
        return get_allowed_transitions(obj.status)

    def get_hours_in_queue(self, obj):
        if obj.submitted_at:
            delta = timezone.now() - obj.submitted_at
            return round(delta.total_seconds() / 3600, 1)
        return 0

class KYCSubmissionCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating KYC submission form data."""

    class Meta:
        model = KYCSubmission
        fields = [
            "full_name",
            "email",
            "phone",
            "business_name",
            "business_type",
            "monthly_volume_usd",
        ]

    def create(self, validated_data):
        validated_data["merchant"] = self.context["request"].user
        return super().create(validated_data)


# --- Action Serializers ---


class SubmissionActionSerializer(serializers.Serializer):
    """Serializer for approve/reject/request_info actions."""

    reason = serializers.CharField(required=False, allow_blank=True, default="")


# --- Notification Serializer ---


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "event_type", "timestamp", "payload"]
