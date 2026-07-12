from fastapi import APIRouter

from backend.services.river_service import (
    get_latest_river,
    get_river_history
)

router = APIRouter(
    prefix="/river",
    tags=["River"]
)


@router.get("/latest")
def latest_river():

    return get_latest_river()


@router.get("/history")
def river_history():

    return get_river_history()