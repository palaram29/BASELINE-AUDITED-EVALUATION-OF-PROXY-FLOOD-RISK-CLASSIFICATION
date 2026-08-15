from fastapi import APIRouter, Depends, HTTPException

from backend.routes.auth import get_current_user_id
from backend.services import alert_service, auth_service
from backend.services.auth_service import AuthError

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("/me")
def my_alert(user_id: int = Depends(get_current_user_id)):
    """The logged-in user's current flood-alert status, derived from the
    latest prediction for their chosen alert_city."""

    try:
        user = auth_service.get_user_by_id(user_id)
    except AuthError as e:
        # A valid, unexpired JWT can still reference a user_id that no
        # longer exists (e.g. deleted account) - every other route in
        # this project turns AuthError into a clean 404 instead of
        # letting it surface as an unhandled 500; this one didn't.
        raise HTTPException(status_code=404, detail=str(e))

    return alert_service.get_alert_for_city(user["alert_city"])
