from fastapi import APIRouter

from backend.services.health_service import check_health

router = APIRouter(
    prefix="/health",
    tags=["Health"]
)


@router.get("/")
def health():

    return check_health()