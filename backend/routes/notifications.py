from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from backend.routes.auth import get_current_user_id
from backend.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class MarkReadRequest(BaseModel):
    # Omit / empty list => mark every unread notification for this user.
    ids: list[int] | None = Field(default=None)


@router.get("")
def my_notifications(user_id: int = Depends(get_current_user_id)):
    """The logged-in user's in-app flood-alert history, newest first."""

    return notification_service.list_notifications(user_id)


@router.get("/unread-count")
def my_unread_count(user_id: int = Depends(get_current_user_id)):
    return notification_service.unread_count(user_id)


@router.post("/mark-read")
def mark_notifications_read(
    payload: MarkReadRequest,
    user_id: int = Depends(get_current_user_id),
):
    return notification_service.mark_read(user_id, payload.ids)
