# EXPLAINER.md

## 1. The State Machine

**Where does your state machine live in the code?**

All state transition logic lives in a single file: [`backend/kyc/state_machine.py`](backend/kyc/state_machine.py).

```python
# Legal transitions: current_state -> [allowed_next_states]
TRANSITIONS = {
    'draft': ['submitted'],
    'submitted': ['under_review'],
    'under_review': ['approved', 'rejected', 'more_info_requested'],
    'more_info_requested': ['submitted'],
    'approved': [],
    'rejected': [],
}

def validate_transition(current_state, new_state):
    allowed = TRANSITIONS.get(current_state, [])
    if new_state not in allowed:
        raise InvalidTransitionError(current_state, new_state)
    return True
```

**How do you prevent an illegal transition?**

The `KYCSubmission.transition_to()` method is the **only** way to change status. It calls `validate_transition()` before any update. If the transition is illegal, it raises `InvalidTransitionError`, which the view catches and returns as HTTP 400 with a clear message:

```json
{
  "error": "Invalid State Transition",
  "detail": "Invalid transition: 'submitted' → 'approved'. Allowed transitions from 'submitted': ['under_review']",
  "code": "invalid_transition"
}
```

No view or serializer ever sets `status` directly — it always goes through `transition_to()`.

---

## 2. The Upload

**How are you validating file uploads?**

File validation lives in [`backend/kyc/validators.py`](backend/kyc/validators.py):

```python
ALLOWED_MIME_TYPES = {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

def validate_document_file(file):
    # 1. Check file size
    if file.size > MAX_FILE_SIZE:
        raise ValidationError(f"File size {file.size / (1024*1024):.1f} MB exceeds 5 MB.")

    # 2. Read magic bytes to detect actual file type (not just extension)
    file_header = file.read(2048)
    file.seek(0)
    detected_mime = magic.from_buffer(file_header, mime=True)

    if detected_mime not in ALLOWED_MIME_TYPES:
        raise ValidationError(f"File type '{detected_mime}' is not allowed.")

    # 3. Check extension matches detected MIME type
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in ALLOWED_MIME_TYPES[detected_mime]:
        raise ValidationError(f"File extension '{ext}' does not match detected type.")
```

**What happens if someone sends a 50 MB file?**

1. Django's `DATA_UPLOAD_MAX_MEMORY_SIZE` is set to 10 MB in settings, so files above that are handled as temporary files on disk (not loaded into memory).
2. The validator checks `file.size > MAX_FILE_SIZE` (5 MB) as the first check and immediately rejects it with a clear error message before doing any further processing.
3. Even if someone renames `malware.exe` to `document.pdf`, the magic bytes check catches it because we read the actual file header, not just the extension.

---

## 3. The Queue

**Paste the query that powers the reviewer dashboard.**

The queue query with dynamic SLA flag (from `views.py`):

```python
now = timezone.now()
KYCSubmission.objects.filter(
    status__in=["submitted", "under_review", "approved", "rejected", "more_info_requested"]
).annotate(
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
).order_by("submitted_at")  # oldest first
```

The `hours_in_queue` is computed in the serializer for database portability:

```python
def get_hours_in_queue(self, obj):
    if obj.submitted_at:
        delta = timezone.now() - obj.submitted_at
        return round(delta.total_seconds() / 3600, 1)
    return 0
```

**Why did you write it this way?**

- `is_at_risk` is computed dynamically via `Case/When` annotation — no stored boolean flag that could go stale.
- Only submissions with `status="submitted"` can be "at risk" (items already under review don't count).
- `hours_in_queue` is computed in the serializer rather than a DB annotation because `Extract('epoch')` on `DurationField` is PostgreSQL-specific and breaks on SQLite (used in tests). The Python computation is equally fast since we already have `submitted_at`.
- Queue is ordered `oldest first` (`submitted_at` ascending) so reviewers process the longest-waiting submissions first.

---

## 4. The Auth

**How does your system stop merchant A from seeing merchant B's submission?**

The check is in `SubmissionViewSet.get_queryset()` ([`backend/kyc/views.py`](backend/kyc/views.py)):

```python
class SubmissionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsMerchant]

    def get_queryset(self):
        # Merchants can only see their own submissions
        return KYCSubmission.objects.filter(merchant=self.request.user)
```

This means:
1. The `IsMerchant` permission class first verifies the user has `role="merchant"`.
2. The queryset is **always filtered** by `merchant=request.user` — there's no way to access another merchant's data, not even by guessing the submission ID.
3. If merchant A tries to access `/api/v1/submissions/5/` and submission 5 belongs to merchant B, Django returns 404 (not 403) — so you can't even confirm whether the submission exists.
4. Reviewers use a completely separate endpoint (`/api/v1/queue/`) with `IsReviewer` permission.

The permission class itself ([`backend/kyc/permissions.py`](backend/kyc/permissions.py)):

```python
class IsMerchant(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "profile")
            and request.user.profile.role == "merchant"
        )
```

---

## 5. The AI Audit

**One specific example where an AI tool wrote code that was buggy or insecure.**

**What it gave me:** The initial SLA `hours_in_queue` annotation used PostgreSQL-specific SQL:

```python
hours_in_queue=Case(
    When(
        submitted_at__isnull=False,
        then=ExpressionWrapper(
            Extract(
                ExpressionWrapper(
                    Value(now) - F("submitted_at"),
                    output_field=DurationField(),
                ),
                "epoch",
            ) / Value(3600.0),
            output_field=FloatField(),
        ),
    ),
    default=Value(0.0),
    output_field=FloatField(),
),
```

**What I caught:** `Extract('epoch')` on a `DurationField` is a PostgreSQL-specific operation. When running tests with SQLite (which is necessary because Neon's connection pooler keeps sessions alive and blocks test database creation/destruction), it throws:

```
ValueError: Extract requires DurationField database support
```

This is a real portability bug — the code works in production (PostgreSQL) but fails in testing (SQLite).

**What I replaced it with:** Moved the computation to the serializer layer where it's pure Python:

```python
def get_hours_in_queue(self, obj):
    if obj.submitted_at:
        delta = timezone.now() - obj.submitted_at
        return round(delta.total_seconds() / 3600, 1)
    return 0
```

This works on every database backend. The `is_at_risk` annotation stays in the queryset because `Case/When` with date comparisons works on both PostgreSQL and SQLite — only `Extract('epoch')` on intervals is the problematic one.

---

## 6. Optional Bonuses Achieved

- **PostgreSQL vs SQLite Flexibility:** We structured the `settings.py` so that the app uses a persistent Neon PostgreSQL db by default (for production/dev performance). Our Django test suite, however, automatically detects `manage.py test` execution and falls back natively to SQLite, avoiding remote connection pooler bottlenecks during tests.
- **Drag-and-Drop Document Upload:** Built cleanly using native React and the HTML5 drag-and-drop API inside a custom `DropzoneCard` component. The system features fluid state changes for visual feedback (dashed borders, colored text overlays) during file drags without needing massive third-party libraries.
- **Reviewer Assignment Round-Robin:** Integrated directly into the state machine inside `models.py`. The instant a submission completes the `draft` → `submitted` state transition, it fires a query to find the last assigned reviewer and rolls the pointer to the next active reviewer. We also updated the Dashboard Query (`kyc/views.py`) so a logged-in reviewer only pulls queue items specifically assigned to them (or currently unassigned orphans due to logic overrides).
