"""
API Views for the KYC Pipeline.

Endpoint summary:
  /api/v1/auth/register/         POST   — Create account
  /api/v1/auth/login/            POST   — Get auth token
  /api/v1/auth/me/               GET    — Current user info

  /api/v1/submissions/           GET    — Merchant: list own submissions
  /api/v1/submissions/           POST   — Merchant: create new draft
  /api/v1/submissions/{id}/      GET    — Detail view (owner or reviewer)
  /api/v1/submissions/{id}/      PATCH  — Merchant: update draft
  /api/v1/submissions/{id}/submit/ POST — Merchant: draft → submitted
  /api/v1/submissions/{id}/documents/ POST — Merchant: upload document

  /api/v1/queue/                 GET    — Reviewer: list submitted items
  /api/v1/queue/metrics/         GET    — Reviewer: dashboard metrics
  /api/v1/queue/{id}/start_review/ POST — submitted → under_review
  /api/v1/queue/{id}/approve/    POST   — under_review → approved
  /api/v1/queue/{id}/reject/     POST   — under_review → rejected
  /api/v1/queue/{id}/request_info/ POST — under_review → more_info_requested
"""

import magic
from datetime import timedelta
from django.utils import timezone
from django.db.models import (
    Avg,
    Count,
    Q,
    F,
    ExpressionWrapper,
    DurationField,
    Case,
    When,
    Value,
    BooleanField,
    FloatField,
)
from django.db.models.functions import Extract
from django.contrib.auth import authenticate
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token

from .models import KYCSubmission, Document, Notification
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    KYCSubmissionListSerializer,
    KYCSubmissionDetailSerializer,
    KYCSubmissionCreateUpdateSerializer,
    DocumentUploadSerializer,
    DocumentSerializer,
    SubmissionActionSerializer,
    NotificationSerializer,
)
from .permissions import IsMerchant, IsReviewer, IsOwnerOrReviewer
from .state_machine import InvalidTransitionError


# ============================================================
# Auth Views
# ============================================================


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def register_view(request):
    """Create a new user account (merchant or reviewer)."""
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.profile.role,
            },
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """Authenticate and return a token."""
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = authenticate(
        username=serializer.validated_data["username"],
        password=serializer.validated_data["password"],
    )
    if not user:
        return Response(
            {
                "error": "Authentication Failed",
                "detail": "Invalid username or password.",
                "code": "invalid_credentials",
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )
    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.profile.role,
            },
        }
    )


@api_view(["GET"])
def me_view(request):
    """Return the current authenticated user's info."""
    return Response(
        {
            "id": request.user.id,
            "username": request.user.username,
            "role": request.user.profile.role,
        }
    )


# ============================================================
# Merchant Submission Views
# ============================================================


class SubmissionViewSet(viewsets.ModelViewSet):
    """
    Merchant-facing endpoints for KYC submissions.

    list:   GET /api/v1/submissions/        — merchant's own submissions
    create: POST /api/v1/submissions/       — create new draft
    detail: GET /api/v1/submissions/{id}/   — view submission
    update: PATCH /api/v1/submissions/{id}/ — update draft fields
    """

    permission_classes = [permissions.IsAuthenticated, IsMerchant]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        """Merchants can only see their own submissions."""
        return (
            KYCSubmission.objects.filter(merchant=self.request.user)
            .annotate(document_count=Count("documents"))
            .select_related("merchant")
        )

    def get_serializer_class(self):
        if self.action == "list":
            return KYCSubmissionListSerializer
        if self.action in ("create", "partial_update"):
            return KYCSubmissionCreateUpdateSerializer
        return KYCSubmissionDetailSerializer

    def perform_create(self, serializer):
        serializer.save(merchant=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        """Only allow updates to draft or more_info_requested submissions."""
        instance = self.get_object()
        if instance.status not in ("draft", "more_info_requested"):
            return Response(
                {
                    "error": "Cannot Update",
                    "detail": f"Submission in '{instance.status}' status cannot be edited.",
                    "code": "invalid_update",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        """Transition from draft/more_info_requested → submitted."""
        submission = self.get_object()

        # Validate required fields before submission
        required = ["full_name", "email", "phone", "business_name", "business_type"]
        missing = [f for f in required if not getattr(submission, f)]
        if missing:
            return Response(
                {
                    "error": "Incomplete Submission",
                    "detail": f"Missing required fields: {', '.join(missing)}",
                    "code": "incomplete_submission",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check at least one document is uploaded
        if not submission.documents.exists():
            return Response(
                {
                    "error": "Incomplete Submission",
                    "detail": "At least one document must be uploaded before submitting.",
                    "code": "no_documents",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            submission.transition_to("submitted")
        except InvalidTransitionError as e:
            return Response(
                {
                    "error": "Invalid State Transition",
                    "detail": e.message,
                    "code": "invalid_transition",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            KYCSubmissionDetailSerializer(submission, context={"request": request}).data
        )

    @action(detail=True, methods=["post"], url_path="documents")
    def upload_document(self, request, pk=None):
        """Upload a document to a submission."""
        submission = self.get_object()

        if submission.status not in ("draft", "more_info_requested"):
            return Response(
                {
                    "error": "Cannot Upload",
                    "detail": f"Cannot upload documents to a '{submission.status}' submission.",
                    "code": "invalid_upload",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]
        doc_type = serializer.validated_data["doc_type"]

        # Read mime type using magic bytes
        file_header = uploaded_file.read(2048)
        uploaded_file.seek(0)
        detected_mime = magic.from_buffer(file_header, mime=True)

        # Delete existing document of same type (replace)
        Document.objects.filter(
            submission=submission, doc_type=doc_type
        ).delete()

        doc = Document.objects.create(
            submission=submission,
            doc_type=doc_type,
            file=uploaded_file,
            original_filename=uploaded_file.name,
            file_size=uploaded_file.size,
            mime_type=detected_mime,
        )

        return Response(
            DocumentSerializer(doc, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


# ============================================================
# Reviewer Queue Views
# ============================================================


class ReviewQueueViewSet(viewsets.GenericViewSet):
    """
    Reviewer-facing endpoints for the review queue.

    list:         GET /api/v1/queue/               — all submitted/under_review
    retrieve:     GET /api/v1/queue/{id}/           — detail view
    start_review: POST /api/v1/queue/{id}/start_review/
    approve:      POST /api/v1/queue/{id}/approve/
    reject:       POST /api/v1/queue/{id}/reject/
    request_info: POST /api/v1/queue/{id}/request_info/
    metrics:      GET /api/v1/queue/metrics/
    """

    permission_classes = [permissions.IsAuthenticated, IsReviewer]
    serializer_class = KYCSubmissionDetailSerializer

    def get_queryset(self):
        """
        Return submissions in reviewable states with SLA annotation.
        SLA at_risk = in queue (submitted status) for more than 24 hours.
        Computed dynamically — no stored flag.
        """
        now = timezone.now()
        return (
            KYCSubmission.objects.filter(
                status__in=["submitted", "under_review", "approved", "rejected", "more_info_requested"]
            )
            .filter(Q(reviewer=self.request.user) | Q(reviewer__isnull=True))
            .annotate(
                document_count=Count("documents"),
                is_at_risk=Case(
                    When(
                        status="submitted",
                        submitted_at__lte=now - timedelta(hours=24),
                        then=Value(True),
                    ),
                    default=Value(False),
                    output_field=BooleanField(),
                ),
            )
            .select_related("merchant", "reviewer")
            .prefetch_related("documents")
            .order_by("submitted_at")  # oldest first
        )

    def list(self, request):
        """List all submissions in the queue (oldest first)."""
        queryset = self.get_queryset()

        # Allow filtering by status
        status_filter = request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        serializer = KYCSubmissionListSerializer(
            queryset, many=True, context={"request": request}
        )
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """Get full detail of a submission."""
        submission = self.get_queryset().filter(pk=pk).first()
        if not submission:
            return Response(
                {
                    "error": "Not Found",
                    "detail": "Submission not found.",
                    "code": "not_found",
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = KYCSubmissionDetailSerializer(
            submission, context={"request": request}
        )
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="start_review")
    def start_review(self, request, pk=None):
        """Transition: submitted → under_review."""
        return self._do_transition(request, pk, "under_review")

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Transition: under_review → approved."""
        return self._do_transition(request, pk, "approved")

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Transition: under_review → rejected."""
        return self._do_transition(request, pk, "rejected")

    @action(detail=True, methods=["post"], url_path="request_info")
    def request_info(self, request, pk=None):
        """Transition: under_review → more_info_requested."""
        return self._do_transition(request, pk, "more_info_requested")

    @action(detail=False, methods=["get"])
    def metrics(self, request):
        """
        Dashboard metrics for the reviewer:
        - submissions_in_queue: count of 'submitted' items
        - avg_time_in_queue_hours: average hours submitted items have been waiting
        - approval_rate_7d: approval rate over the last 7 days
        """
        now = timezone.now()
        seven_days_ago = now - timedelta(days=7)

        # Count of submitted items in queue
        in_queue = KYCSubmission.objects.filter(status="submitted").count()

        # Average time in queue for submitted items
        avg_duration = KYCSubmission.objects.filter(
            status="submitted",
            submitted_at__isnull=False,
        ).aggregate(
            avg_wait=Avg(
                ExpressionWrapper(
                    Value(now) - F("submitted_at"),
                    output_field=DurationField(),
                )
            )
        )["avg_wait"]

        avg_hours = 0
        if avg_duration:
            avg_hours = round(avg_duration.total_seconds() / 3600, 1)

        # Approval rate over last 7 days
        recent_decisions = KYCSubmission.objects.filter(
            status__in=["approved", "rejected"],
            updated_at__gte=seven_days_ago,
        )
        total_decisions = recent_decisions.count()
        approved_count = recent_decisions.filter(status="approved").count()
        approval_rate = (
            round((approved_count / total_decisions) * 100, 1)
            if total_decisions > 0
            else 0
        )

        # Total counts
        total_submissions = KYCSubmission.objects.count()
        under_review = KYCSubmission.objects.filter(status="under_review").count()

        return Response(
            {
                "submissions_in_queue": in_queue,
                "avg_time_in_queue_hours": avg_hours,
                "approval_rate_7d": approval_rate,
                "total_submissions": total_submissions,
                "under_review": under_review,
                "total_decisions_7d": total_decisions,
            }
        )

    def _do_transition(self, request, pk, new_state):
        """Helper: perform a state transition on a submission."""
        submission = KYCSubmission.objects.filter(pk=pk).first()
        if not submission:
            return Response(
                {
                    "error": "Not Found",
                    "detail": "Submission not found.",
                    "code": "not_found",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        action_serializer = SubmissionActionSerializer(data=request.data)
        action_serializer.is_valid(raise_exception=True)
        reason = action_serializer.validated_data.get("reason", "")

        try:
            submission.transition_to(
                new_state,
                reviewer=request.user,
                reason=reason,
            )
        except InvalidTransitionError as e:
            return Response(
                {
                    "error": "Invalid State Transition",
                    "detail": e.message,
                    "code": "invalid_transition",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Re-fetch with annotations
        submissions = self.get_queryset().filter(pk=pk)
        if submissions.exists():
            submission = submissions.first()

        serializer = KYCSubmissionDetailSerializer(
            submission, context={"request": request}
        )
        return Response(serializer.data)
