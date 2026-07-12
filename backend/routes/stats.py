from fastapi import APIRouter

from backend.services.stats_service import get_system_statistics

router = APIRouter(
    prefix="/stats",
    tags=["Statistics"]
)


@router.get("/")
def statistics():

    return get_system_statistics()