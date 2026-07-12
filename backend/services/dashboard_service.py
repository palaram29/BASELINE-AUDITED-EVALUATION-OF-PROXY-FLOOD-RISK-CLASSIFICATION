from backend.services.weather_service import get_latest_weather
from backend.services.river_service import get_latest_river
from backend.services.prediction_service import get_latest_predictions


def get_dashboard_data():

    weather = get_latest_weather()

    river = get_latest_river()

    prediction = get_latest_predictions()

    return {
        "weather": weather,
        "river": river,
        "prediction": prediction
    }