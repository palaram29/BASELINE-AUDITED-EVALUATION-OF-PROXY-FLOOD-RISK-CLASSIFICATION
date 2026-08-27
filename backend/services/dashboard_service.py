from backend.services.weather_service import get_latest_weather
from backend.services.river_service import get_latest_river
from backend.services.prediction_service import get_latest_predictions
from backend.services.live_risk_service import get_latest_live_risk


def get_dashboard_data():

    weather = get_latest_weather()

    river = get_latest_river()

    prediction = get_latest_predictions()

    # Same-day ("Today") rule-based risk index, the counterpart to
    # `prediction` (the t+1 "Tomorrow" ML forecast). Never fails the
    # dashboard: an empty list if params/features aren't ready yet.
    try:
        live_risk = get_latest_live_risk()
    except Exception:
        live_risk = []

    return {
        "weather": weather,
        "river": river,
        "prediction": prediction,
        "live_risk": live_risk
    }