from fastapi import APIRouter
from backend.services.weather_service import (
    get_latest_weather,
    get_weather_history
)

router = APIRouter(
    prefix="/weather",
    tags=["Weather"]
)


@router.get("/latest")
def latest_weather():

    return get_latest_weather()


@router.get("/history")
def weather_history():

    return get_weather_history()