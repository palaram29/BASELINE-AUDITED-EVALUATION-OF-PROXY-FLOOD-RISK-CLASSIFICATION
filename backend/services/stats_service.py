import pandas as pd
from database.db_connection import get_engine

engine = get_engine()


def get_system_statistics():

    weather_query = """
    SELECT COUNT(DISTINCT "City") AS weather_stations
    FROM weather_data;
    """

    river_query = """
    SELECT COUNT(*) AS river_stations
    FROM (
        SELECT DISTINCT "River", "Station"
        FROM river_data
    ) AS stations;
    """

    prediction_query = """
    SELECT COUNT(*) AS prediction_count
    FROM prediction_results
    WHERE "Date" = (
        SELECT MAX("Date")
        FROM prediction_results
    );
    """

    high_risk_river_query = """
    SELECT COUNT(*) AS high_risk_rivers
    FROM river_data
    WHERE "RiverRisk" IN ('High', 'Very High');
    """

    # Predicted_Risk's real values are Low/Medium/High/Extreme (the ML
    # model's training labels - see ML/data/train_dataset.csv), NOT
    # "Very High" (that's river_data's RiverRisk vocabulary, a different
    # table). Using 'Very High' here silently undercounts every Extreme
    # prediction - the single most severe class - to 0. See
    # flood-frontend/src/utils/riskLevels.js's normalizeRisk() and
    # backend/services/alert_service.py's normalize_risk() for why this
    # project deliberately keeps the two vocabularies distinct rather
    # than merging them.
    high_risk_prediction_query = """
    SELECT COUNT(*) AS high_risk_predictions
    FROM prediction_results
    WHERE "Predicted_Risk" IN ('High', 'Extreme')
    AND "Date" = (
        SELECT MAX("Date")
        FROM prediction_results
    );
    """

    weather = pd.read_sql(weather_query, engine)
    river = pd.read_sql(river_query, engine)
    prediction = pd.read_sql(prediction_query, engine)
    river_risk = pd.read_sql(high_risk_river_query, engine)
    prediction_risk = pd.read_sql(high_risk_prediction_query, engine)

    return {
        "weatherStations": int(weather.iloc[0]["weather_stations"]),
        "riverStations": int(river.iloc[0]["river_stations"]),
        "predictionCount": int(prediction.iloc[0]["prediction_count"]),
        "highRiskRivers": int(river_risk.iloc[0]["high_risk_rivers"]),
        "highRiskPredictions": int(prediction_risk.iloc[0]["high_risk_predictions"])
    }