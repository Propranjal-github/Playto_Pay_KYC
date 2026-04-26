"""
Models for the KYC Pipeline.

UserProfile  — extends Django User with a role field (merchant / reviewer)
KYCSubmission — the main KYC application with state machine enforcement
Document     — uploaded files attached to a submission
Notification — event log for state transitions
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from .state_machine import (
    validate_transition,
    STATE_CHOICES,
    DRAFT,
    InvalidTransitionError,
)


class UserProfile(models.Model):
    """Extends the Django User model with a role."""

    ROLE_CHOICES = [
        ("merchant", "Merchant"),
        ("reviewer", "Reviewer"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class KYCSubmission(models.Model):
    """
    A merchant's KYC submission that moves through states:
    draft → submitted → under_review → approved/rejected/more_info_requested
    """

    BUSINESS_TYPE_CHOICES = [
        ("agency", "Agency"),
        ("freelancer", "Freelancer"),
        ("startup", "Startup"),
        ("enterprise", "Enterprise"),
        ("other", "Other"),
    ]

    # --- Relationships ---
    merchant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="submissions",
    )

    # --- Status (state machine enforced) ---
    status = models.CharField(
        max_length=25,
        choices=STATE_CHOICES,
        default=DRAFT,
        db_index=True,
    )

    # --- Personal Details ---
    full_name = models.CharField(max_length=255, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")

    # --- Business Details ---
    business_name = models.CharField(max_length=255, blank=True, default="")
    business_type = models.CharField(
        max_length=20,
        choices=BUSINESS_TYPE_CHOICES,
        blank=True,
        default="",
    )
    monthly_volume_usd = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    # --- Review details ---
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_submissions",
    )
    review_reason = models.TextField(blank=True, default="")

    # --- Timestamps ---
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"KYC #{self.pk} — {self.merchant.username} ({self.status})"

    def transition_to(self, new_state, reviewer=None, reason=""):
        """
        Transition the submission to a new state.

        This is the ONLY way to change the status. It:
          1. Validates the transition via the state machine
          2. Updates status and related fields
          3. Logs a notification event

        Raises InvalidTransitionError if the transition is illegal.
        """
        old_state = self.status

        # This will raise InvalidTransitionError if not allowed
        validate_transition(old_state, new_state)

        # Update status
        self.status = new_state

        # Set submitted_at timestamp on first submission
        if new_state == "submitted":
            self.submitted_at = timezone.now()
            # Apply round-robin reviewer assignment if unassigned
            if not getattr(self, 'reviewer_id', None):
                self.reviewer = self.__class__.get_next_reviewer()

        # Set reviewer info
        if reviewer:
            self.reviewer = reviewer
        if reason:
            self.review_reason = reason

        self.save()

        # Log notification event
        Notification.objects.create(
            merchant=self.merchant,
            event_type=f"submission_{new_state}",
            payload={
                "submission_id": self.pk,
                "old_status": old_state,
                "new_status": new_state,
                "reason": reason,
            },
        )

        return self

    @classmethod
    def get_next_reviewer(cls):
        """
        Round-robin assignment: get the reviewer next in sequence
        after the one who received the last assigned submission.
        """
        from django.contrib.auth import get_user_model
        User = get_user_model()
        reviewers = list(User.objects.filter(profile__role="reviewer").order_by("id"))
        
        if not reviewers:
            return None
            
        last_submission = cls.objects.filter(reviewer__isnull=False).order_by("-submitted_at").first()
        
        if last_submission and last_submission.reviewer:
            try:
                current_idx = reviewers.index(last_submission.reviewer)
                return reviewers[(current_idx + 1) % len(reviewers)]
            except ValueError:
                pass
                
        return reviewers[0]


class Document(models.Model):
    """A document uploaded as part of a KYC submission."""

    DOC_TYPE_CHOICES = [
        ("pan", "PAN Card"),
        ("aadhaar", "Aadhaar Card"),
        ("bank_statement", "Bank Statement"),
    ]

    submission = models.ForeignKey(
        KYCSubmission,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    doc_type = models.CharField(max_length=20, choices=DOC_TYPE_CHOICES)
    file = models.FileField(upload_to="documents/%Y/%m/%d/")
    original_filename = models.CharField(max_length=255)
    file_size = models.IntegerField(help_text="File size in bytes")
    mime_type = models.CharField(max_length=50)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # One document per type per submission
        unique_together = ["submission", "doc_type"]

    def __str__(self):
        return f"{self.get_doc_type_display()} — Submission #{self.submission_id}"


class Notification(models.Model):
    """
    Event log for state transitions.
    Records what should be sent (email, SMS, etc.) — but does not actually send.
    """

    merchant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    event_type = models.CharField(max_length=50, db_index=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    payload = models.JSONField(default=dict)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.event_type} — {self.merchant.username} @ {self.timestamp}"
