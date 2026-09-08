from fastapi import APIRouter

from backend.services.prediction_service import (
    get_latest_predictions,
    get_prediction_history,
    get_tomorrow_forecast_comparison
)
from backend.services.live_risk_service import (
    get_latest_live_risk,
    get_live_risk_history
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


@router.get("/live")
def live_prediction():
    """The same-day ("Today") flood-risk index for every monitored city.

    A deterministic Hazard x Vulnerability rule scored on the latest live
    weather - NOT the frozen t+1 ML model (that is /prediction/latest).
    See backend/services/live_risk_service.py."""

    return get_latest_live_risk()


@router.get("/live/history")
def live_prediction_history():

    return get_live_risk_history()


@router.get("/tomorrow-comparison")
def tomorrow_forecast_comparison():
    """Both forecasts for tomorrow, side by side: the persistence
    baseline (primary, per the paper's headline result and the
    supervisor-review decision to serve both) and the frozen ML model
    (secondary, always carrying an experimental-model disclaimer).

    See backend/services/prediction_service.get_tomorrow_forecast_comparison
    for how the two are combined; neither underlying computation changes.
    """

    return get_tomorrow_forecast_comparison()