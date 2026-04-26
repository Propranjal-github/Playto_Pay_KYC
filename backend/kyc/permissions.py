"""
Custom permissions for the KYC API.

Merchants and reviewers are different roles:
  - Merchants can only access their own submissions.
  - Reviewers can access all submissions in the queue.
"""

from rest_framework.permissions import BasePermission


class IsMerchant(BasePermission):
    """Allow access only to users with the 'merchant' role."""

    message = "Only merchants can perform this action."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "profile")
            and request.user.profile.role == "merchant"
        )


class IsReviewer(BasePermission):
    """Allow access only to users with the 'reviewer' role."""

    message = "Only reviewers can perform this action."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "profile")
            and request.user.profile.role == "reviewer"
        )


class IsOwnerOrReviewer(BasePermission):
    """
    Object-level permission:
      - Merchants can only access their own submissions.
      - Reviewers can access any submission.
    """

    message = "You do not have permission to access this submission."

    def has_object_permission(self, request, view, obj):
        if hasattr(request.user, "profile"):
            if request.user.profile.role == "reviewer":
                return True
            if request.user.profile.role == "merchant":
                return obj.merchant == request.user
        return False
