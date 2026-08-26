"""User-management API for the operator console (flood-frontend/'s new
"Users" page) - read-only, see backend/services/admin_service.py for why
this has no auth check, same as backend/routes/mlops.py and
backend/routes/reliability.py.
"""

from fastapi import APIRouter

from backend.services import admin_service

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users")
def list_users():
    """Every citizen-frontend registration, newest first, with their
    notification history and the CURRENT live risk for their alert_city."""

    return admin_service.get_all_users()
