from fastapi import APIRouter

from backend.services.system_service import (
    run_weather,
    run_river,
    run_ml,
    run_prediction
)

router = APIRouter(
    prefix="/system",
    tags=["System"]
)


@router.post("/weather")
def weather():

    return run_weather()


@router.post("/river")
def river():

    return run_river()


@router.post("/ml")
def ml():

    return run_ml()


@router.post("/predict")
def predict():

    return run_prediction()