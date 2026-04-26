"""
Tests for KYC Pipeline — focusing on state machine enforcement.
"""

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token
from kyc.models import UserProfile, KYCSubmission, Document, Notification
from kyc.state_machine import (
    validate_transition,
    InvalidTransitionError,
    get_allowed_transitions,
)


class StateMachineUnitTests(TestCase):
    """Unit tests for the state machine module directly."""

    def test_valid_transition_draft_to_submitted(self):
        """Legal: draft → submitted should pass."""
        self.assertTrue(validate_transition("draft", "submitted"))

    def test_valid_transition_submitted_to_under_review(self):
        """Legal: submitted → under_review should pass."""
        self.assertTrue(validate_transition("submitted", "under_review"))

    def test_valid_transition_under_review_to_approved(self):
        """Legal: under_review → approved should pass."""
        self.assertTrue(validate_transition("under_review", "approved"))

    def test_valid_transition_under_review_to_rejected(self):
        """Legal: under_review → rejected should pass."""
        self.assertTrue(validate_transition("under_review", "rejected"))

    def test_valid_transition_under_review_to_more_info(self):
        """Legal: under_review → more_info_requested should pass."""
        self.assertTrue(validate_transition("under_review", "more_info_requested"))

    def test_valid_transition_more_info_to_submitted(self):
        """Legal: more_info_requested → submitted should pass."""
        self.assertTrue(validate_transition("more_info_requested", "submitted"))

    def test_illegal_transition_draft_to_approved(self):
        """Illegal: draft → approved should raise InvalidTransitionError."""
        with self.assertRaises(InvalidTransitionError) as ctx:
            validate_transition("draft", "approved")
        self.assertIn("draft", str(ctx.exception))
        self.assertIn("approved", str(ctx.exception))

    def test_illegal_transition_approved_to_draft(self):
        """Illegal: approved → draft should raise (approved is terminal)."""
        with self.assertRaises(InvalidTransitionError):
            validate_transition("approved", "draft")

    def test_illegal_transition_submitted_to_approved(self):
        """Illegal: submitted → approved (skipping under_review)."""
        with self.assertRaises(InvalidTransitionError):
            validate_transition("submitted", "approved")

    def test_illegal_transition_rejected_to_approved(self):
        """Illegal: rejected → approved (rejected is terminal)."""
        with self.assertRaises(InvalidTransitionError):
            validate_transition("rejected", "approved")

    def test_get_allowed_transitions(self):
        """get_allowed_transitions returns correct states."""
        self.assertEqual(get_allowed_transitions("draft"), ["submitted"])
        self.assertEqual(get_allowed_transitions("approved"), [])
        self.assertIn("approved", get_allowed_transitions("under_review"))


class StateMachineAPITests(TestCase):
    """Integration tests: state transitions via the API."""

    def setUp(self):
        # Create merchant
        self.merchant = User.objects.create_user(
            username="test_merchant", password="test1234"
        )
        UserProfile.objects.create(user=self.merchant, role="merchant")
        self.merchant_token = Token.objects.create(user=self.merchant)

        # Create reviewer
        self.reviewer = User.objects.create_user(
            username="test_reviewer", password="test1234"
        )
        UserProfile.objects.create(user=self.reviewer, role="reviewer")
        self.reviewer_token = Token.objects.create(user=self.reviewer)

        # Merchant client
        self.merchant_client = APIClient()
        self.merchant_client.credentials(
            HTTP_AUTHORIZATION=f"Token {self.merchant_token.key}"
        )

        # Reviewer client
        self.reviewer_client = APIClient()
        self.reviewer_client.credentials(
            HTTP_AUTHORIZATION=f"Token {self.reviewer_token.key}"
        )

    def _create_complete_submission(self):
        """Helper: create a submission with all required fields + a document."""
        sub = KYCSubmission.objects.create(
            merchant=self.merchant,
            status="draft",
            full_name="Test User",
            email="test@test.com",
            phone="1234567890",
            business_name="Test Corp",
            business_type="freelancer",
            monthly_volume_usd=1000,
        )
        # Create a dummy document
        import struct, zlib

        def create_minimal_png():
            def make_chunk(chunk_type, data):
                chunk = chunk_type + data
                return (
                    struct.pack(">I", len(data))
                    + chunk
                    + struct.pack(">I", zlib.crc32(chunk) & 0xFFFFFFFF)
                )

            signature = b"\x89PNG\r\n\x1a\n"
            ihdr_data = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
            ihdr = make_chunk(b"IHDR", ihdr_data)
            raw_data = b"\x00\xff\x00\x00"
            idat = make_chunk(b"IDAT", zlib.compress(raw_data))
            iend = make_chunk(b"IEND", b"")
            return signature + ihdr + idat + iend

        from django.core.files.base import ContentFile

        Document.objects.create(
            submission=sub,
            doc_type="pan",
            file=ContentFile(create_minimal_png(), name="test.png"),
            original_filename="test.png",
            file_size=100,
            mime_type="image/png",
        )
        return sub

    def test_illegal_transition_via_api_returns_400(self):
        """
        Attempting to approve a 'submitted' submission (skipping under_review)
        should return HTTP 400 with a clear error message.
        """
        sub = self._create_complete_submission()
        # Transition to submitted
        sub.transition_to("submitted")

        # Try to approve directly (illegal: submitted → approved)
        response = self.reviewer_client.post(
            f"/api/v1/queue/{sub.pk}/approve/"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "invalid_transition")
        self.assertIn("Invalid transition", response.data["detail"])

    def test_legal_transition_via_api(self):
        """submitted → under_review via API should succeed."""
        sub = self._create_complete_submission()
        sub.transition_to("submitted")

        response = self.reviewer_client.post(
            f"/api/v1/queue/{sub.pk}/start_review/"
        )
        self.assertEqual(response.status_code, 200)
        sub.refresh_from_db()
        self.assertEqual(sub.status, "under_review")

    def test_double_approve_returns_400(self):
        """Approving an already-approved submission should return 400."""
        sub = self._create_complete_submission()
        sub.transition_to("submitted")
        sub.transition_to("under_review")
        sub.transition_to("approved")

        response = self.reviewer_client.post(
            f"/api/v1/queue/{sub.pk}/approve/"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid transition", response.data["detail"])

    def test_notification_created_on_transition(self):
        """A notification event should be logged on each state transition."""
        sub = self._create_complete_submission()
        sub.transition_to("submitted")

        notifications = Notification.objects.filter(
            merchant=self.merchant,
            event_type="submission_submitted",
        )
        self.assertEqual(notifications.count(), 1)
        self.assertEqual(
            notifications.first().payload["submission_id"], sub.pk
        )

    def test_merchant_cannot_see_other_merchant_submission(self):
        """Merchant A cannot access Merchant B's submission."""
        # Create another merchant
        other = User.objects.create_user(username="other_merchant", password="test")
        UserProfile.objects.create(user=other, role="merchant")
        other_sub = KYCSubmission.objects.create(
            merchant=other, status="draft", full_name="Other"
        )

        # Try to access it as test_merchant
        response = self.merchant_client.get(
            f"/api/v1/submissions/{other_sub.pk}/"
        )
        self.assertEqual(response.status_code, 404)

    def test_merchant_cannot_access_queue(self):
        """Merchants should not be able to access the reviewer queue."""
        response = self.merchant_client.get("/api/v1/queue/")
        self.assertEqual(response.status_code, 403)
