"""
Custom exception handler for consistent API error responses.

All errors follow the shape:
{
    "error": "Short error title",
    "detail": "Human-readable description",
    "code": "machine_readable_code"
}
"""

from rest_framework.views import exception_handler
from rest_framework.exceptions import ValidationError


def custom_exception_handler(exc, context):
    """
    Wraps DRF's default exception handler to ensure a consistent
    error response shape across the entire API.
    """
    response = exception_handler(exc, context)

    if response is not None:
        custom_data = {
            "error": _get_error_title(response.status_code),
            "detail": response.data,
            "code": _get_error_code(exc),
        }

        # Flatten detail if it's a simple string or list
        if isinstance(response.data, dict):
            # Keep the dict as-is for field-level errors
            custom_data["detail"] = response.data
        elif isinstance(response.data, list):
            custom_data["detail"] = response.data[0] if len(response.data) == 1 else response.data
        elif isinstance(response.data, str):
            custom_data["detail"] = response.data

        response.data = custom_data

    return response


def _get_error_title(status_code):
    titles = {
        400: "Bad Request",
        401: "Authentication Required",
        403: "Permission Denied",
        404: "Not Found",
        405: "Method Not Allowed",
        409: "Conflict",
        500: "Internal Server Error",
    }
    return titles.get(status_code, "Error")


def _get_error_code(exc):
    if hasattr(exc, "default_code"):
        return exc.default_code
    return "error"
