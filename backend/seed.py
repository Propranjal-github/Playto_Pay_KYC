# -*- coding: utf-8 -*-
"""
Seed script for the Playto KYC Pipeline.

Creates:
  - Merchant Alice   — 1 submission in 'draft' status (partial data)
  - Merchant Bob     — 1 submission in 'under_review' status (complete data + docs)
  - Reviewer Charlie — reviewer account

Usage:
  python manage.py shell < seed.py
  OR
  python manage.py seed  (via management command)
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from kyc.models import UserProfile, KYCSubmission, Document, Notification
from django.core.files.base import ContentFile
from django.utils import timezone
from datetime import timedelta


def seed():
    print("[SEED] Seeding database...\n")

    # Clear existing seed data (idempotent)
    for username in ["merchant_alice", "merchant_bob", "reviewer_charlie"]:
        User.objects.filter(username=username).delete()

    # ─── Merchant Alice ───────────────────────────────────────
    alice = User.objects.create_user(
        username="merchant_alice",
        password="alice123",
    )
    UserProfile.objects.create(user=alice, role="merchant")
    token_alice, _ = Token.objects.get_or_create(user=alice)

    # Alice's submission: DRAFT (partial data, no documents)
    sub_alice = KYCSubmission.objects.create(
        merchant=alice,
        status="draft",
        full_name="Alice Sharma",
        email="alice@example.com",
        phone="",  # incomplete
        business_name="",  # incomplete
        business_type="",
    )
    print(f"[OK] Merchant Alice created (token: {token_alice.key})")
    print(f"     -> Submission #{sub_alice.pk}: draft (partial data)")

    # ─── Reviewer Charlie (Created earlier for Round Robin) ───
    charlie = User.objects.create_user(
        username="reviewer_charlie",
        password="charlie123",
    )
    UserProfile.objects.create(user=charlie, role="reviewer")
    token_charlie, _ = Token.objects.get_or_create(user=charlie)
    print(f"[OK] Reviewer Charlie created (token: {token_charlie.key})")

    # ─── Merchant Bob ─────────────────────────────────────────
    bob = User.objects.create_user(
        username="merchant_bob",
        password="bob12345",
    )
    UserProfile.objects.create(user=bob, role="merchant")
    token_bob, _ = Token.objects.get_or_create(user=bob)

    # Bob's submission: fully filled out
    sub_bob = KYCSubmission.objects.create(
        merchant=bob,
        status="draft",  # Start as draft, then transition
        full_name="Bob Patel",
        email="bob@freelancer.io",
        phone="+91-9876543210",
        business_name="Bob Designs Co.",
        business_type="freelancer",
        monthly_volume_usd=5000.00,
    )

    # Add dummy documents for Bob (small valid PNGs)
    # Create a minimal valid PNG file (1x1 pixel, red)
    import struct
    import zlib

    def create_minimal_png():
        """Create a minimal valid 1x1 red PNG."""

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
        raw_data = b"\x00\xff\x00\x00"  # filter byte + RGB
        idat = make_chunk(b"IDAT", zlib.compress(raw_data))
        iend = make_chunk(b"IEND", b"")
        return signature + ihdr + idat + iend

    png_content = create_minimal_png()

    for doc_type, name in [
        ("pan", "bob_pan_card.png"),
        ("aadhaar", "bob_aadhaar.png"),
        ("bank_statement", "bob_bank_stmt.png"),
    ]:
        Document.objects.create(
            submission=sub_bob,
            doc_type=doc_type,
            file=ContentFile(png_content, name=name),
            original_filename=name,
            file_size=len(png_content),
            mime_type="image/png",
        )

    # Transition Bob's submission: draft → submitted → under_review
    sub_bob.transition_to("submitted")
    sub_bob.transition_to("under_review")

    # Backdate submitted_at by 26 hours so it shows as at_risk
    KYCSubmission.objects.filter(pk=sub_bob.pk).update(
        submitted_at=timezone.now() - timedelta(hours=26)
    )

    print(f"[OK] Merchant Bob created (token: {token_bob.key})")
    print(f"     -> Submission #{sub_bob.pk}: under_review (3 documents, at_risk)")

    print(f"     -> Submission #{sub_bob.pk}: under_review (3 documents, at_risk, assigned to {sub_bob.reviewer})")

    # ─── Summary ──────────────────────────────────────────────
    print("\n" + "=" * 50)
    print("[DONE] Seed complete! Login credentials:")
    print("=" * 50)
    print(f"  merchant_alice  / alice123     (token: {token_alice.key})")
    print(f"  merchant_bob    / bob12345     (token: {token_bob.key})")
    print(f"  reviewer_charlie / charlie123  (token: {token_charlie.key})")
    print("=" * 50)


if __name__ == "__main__":
    seed()
else:
    seed()
