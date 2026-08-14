from fastapi import APIRouter, Depends

from backend.routes.auth import get_current_user_id
from backend.services import alert_service, auth_service

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("/me")
def my_alert(user_id: int = Depends(get_current_user_id)):
    """The logged-in user's current flood-alert status, derived from the
    latest prediction for their chosen alert_city."""

    user = auth_service.get_user_by_id(user_id)
    return alert_service.get_alert_for_city(user["alert_city"])
