"""
File upload validators for KYC documents.

Validates:
  - File type via magic bytes (not just extension)
  - File size (max 5 MB)
  - File extension consistency
"""

import magic
from django.core.exceptions import ValidationError

# Allowed MIME types and corresponding extensions
ALLOWED_MIME_TYPES = {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
}

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def validate_document_file(file):
    """
    Validate an uploaded document file.

    Checks:
      1. File size ≤ 5 MB
      2. MIME type (via magic bytes) is PDF, JPEG, or PNG
      3. File extension matches the detected MIME type

    Args:
        file: An UploadedFile instance.

    Raises:
        ValidationError: If any check fails.
    """
    # --- Check file size ---
    if file.size > MAX_FILE_SIZE:
        raise ValidationError(
            f"File size {file.size / (1024 * 1024):.1f} MB exceeds the "
            f"maximum allowed size of {MAX_FILE_SIZE / (1024 * 1024):.0f} MB."
        )

    # --- Check MIME type via magic bytes ---
    # Read the first 2048 bytes to detect the file type
    file_header = file.read(2048)
    file.seek(0)  # Reset file pointer for downstream use

    detected_mime = magic.from_buffer(file_header, mime=True)

    if detected_mime not in ALLOWED_MIME_TYPES:
        raise ValidationError(
            f"File type '{detected_mime}' is not allowed. "
            f"Accepted types: PDF, JPG, PNG."
        )

    # --- Check file extension matches detected type ---
    import os

    ext = os.path.splitext(file.name)[1].lower()
    allowed_extensions = ALLOWED_MIME_TYPES[detected_mime]

    if ext not in allowed_extensions:
        raise ValidationError(
            f"File extension '{ext}' does not match detected type "
            f"'{detected_mime}'. Expected one of: {allowed_extensions}."
        )

    return True
