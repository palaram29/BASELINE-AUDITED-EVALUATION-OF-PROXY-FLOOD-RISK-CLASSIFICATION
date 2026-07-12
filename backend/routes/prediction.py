from fastapi import APIRouter

from backend.services.prediction_service import (
    get_latest_predictions,
    get_prediction_history
)

router = APIRouter(
    prefix="/prediction",
    tags=["Prediction"]
)


@router.get("/latest")
def latest_prediction():

    return get_latest_predictions()


@router.get("/history")
def prediction_history():

    return get_prediction_history()