"""
State Machine — Single source of truth for KYC submission state transitions.

All valid states and transitions are defined here. No transition logic
should exist anywhere else in the codebase.

States:
    draft               → submitted
    submitted           → under_review
    under_review        → approved | rejected | more_info_requested
    more_info_requested → submitted
"""

# All valid states
DRAFT = "draft"
SUBMITTED = "submitted"
UNDER_REVIEW = "under_review"
APPROVED = "approved"
REJECTED = "rejected"
MORE_INFO_REQUESTED = "more_info_requested"

STATE_CHOICES = [
    (DRAFT, "Draft"),
    (SUBMITTED, "Submitted"),
    (UNDER_REVIEW, "Under Review"),
    (APPROVED, "Approved"),
    (REJECTED, "Rejected"),
    (MORE_INFO_REQUESTED, "More Info Requested"),
]

# Legal transitions: current_state -> [allowed_next_states]
TRANSITIONS = {
    DRAFT: [SUBMITTED],
    SUBMITTED: [UNDER_REVIEW],
    UNDER_REVIEW: [APPROVED, REJECTED, MORE_INFO_REQUESTED],
    MORE_INFO_REQUESTED: [SUBMITTED],
    # Terminal states — no outgoing transitions
    APPROVED: [],
    REJECTED: [],
}


class InvalidTransitionError(Exception):
    """Raised when an illegal state transition is attempted."""

    def __init__(self, current_state, new_state):
        self.current_state = current_state
        self.new_state = new_state
        allowed = TRANSITIONS.get(current_state, [])
        self.message = (
            f"Invalid transition: '{current_state}' → '{new_state}'. "
            f"Allowed transitions from '{current_state}': {allowed}"
        )
        super().__init__(self.message)


def validate_transition(current_state, new_state):
    """
    Validate that a state transition is legal.

    Args:
        current_state: The current state of the submission.
        new_state: The desired new state.

    Returns:
        True if the transition is valid.

    Raises:
        InvalidTransitionError: If the transition is not allowed.
    """
    allowed = TRANSITIONS.get(current_state, [])
    if new_state not in allowed:
        raise InvalidTransitionError(current_state, new_state)
    return True


def get_allowed_transitions(current_state):
    """Return the list of states reachable from current_state."""
    return TRANSITIONS.get(current_state, [])
