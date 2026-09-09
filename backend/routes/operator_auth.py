"""Minimal shared-secret guard for operator-only write endpoints.

The operator console (flood-frontend) has no session login anywhere in
the system - a deliberate, documented prototype decision, not an
oversight (see docs/ML_METHODOLOGY_AND_LIMITATIONS.md). backend/routes/
auth.py's get_current_user_id is CITIZEN account authentication
(registration carries alert_city, the citizen app's own feature) and is
the wrong mechanism to bolt onto operator routes.

This dependency checks a single shared header, X-Operator-Key, against
OPERATOR_API_KEY in the environment. It is intentionally NOT a full
auth system: no per-user identity, no session, no rotation. It exists
to close one specific gap the supervisor review flagged - shelter
write endpoints being reachable with no credential at all - not to
claim the operator console is now access-controlled in general. Every
other operator route (admin.py, mlops.py, reliability.py) remains
exactly as open as it was, per the existing documented convention;
only backend/routes/shelters.py's three write endpoints use this.

Set OPERATOR_API_KEY in your .env before write endpoints will work:
    OPERATOR_API_KEY=choose-a-long-random-value

Requests must then include the header on POST/PUT/DELETE:
    X-Operator-Key: choose-a-long-random-value
"""

import os

from fastapi import Header, HTTPException

OPERATOR_API_KEY_ENV_VAR = "OPERATOR_API_KEY"


def require_operator_key(x_operator_key: str = Header(default=None)) -> None:
    expected = os.getenv(OPERATOR_API_KEY_ENV_VAR)

    if not expected:
        # Fails CLOSED, not open: an unset key must not silently mean
        # "no check", or every prototype deployment that forgets to set
        # OPERATOR_API_KEY would be exactly as unprotected as before.
        raise HTTPException(
            status_code=503,
            detail=(
                f"{OPERATOR_API_KEY_ENV_VAR} is not configured on the server - "
                "shelter write endpoints are disabled until it is set."
            ),
        )

    if x_operator_key != expected:
        raise HTTPException(status_code=401, detail="Missing or invalid X-Operator-Key header.")
