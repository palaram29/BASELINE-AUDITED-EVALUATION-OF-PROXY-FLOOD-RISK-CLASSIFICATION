from fastapi import APIRouter

from backend.services.dashboard_service import get_dashboard_data

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)


@router.get("/")
def dashboard():

    return get_dashboard_data()