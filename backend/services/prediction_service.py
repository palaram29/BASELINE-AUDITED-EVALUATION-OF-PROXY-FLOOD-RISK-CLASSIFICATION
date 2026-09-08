import pandas as pd
from database.db_connection import get_engine
from reliability.scorer import classify as classify_reliability
from reliability.config import RELIABILITY_MEDIUM_THRESHOLD

engine = get_engine()

# Data Source Reliability (see backend/services/reliability_service.py) is
# joined onto every prediction row as data_reliability_score/_level +
# degraded_data_warning - additive keys only, on top of the pre-existing
# response shape. This is reliability-AWARE behaviour, not reliability-
# GATED: predictions are never filtered or discarded for low reliability
# (see §14 of the Data Source Reliability integration) - the frontend
# renders a visible warning banner instead. data_reliability_score/_level
# must never be confused with Probability (the model's own confidence in
# its predicted class) - they measure two different things.


def _attach_reliability(df):
    if df.empty or "Overall_Data_Reliability" not in df.columns:
        df["data_reliability_score"] = None
        df["data_reliability_level"] = None
        df["degraded_data_warning"] = False
        return df

    df["data_reliability_score"] = df["Overall_Data_Reliability"]
    df["data_reliability_level"] = df["Overall_Data_Reliability"].apply(
        lambda v: classify_reliability(v) if pd.notna(v) else None
    )
    df["degraded_data_warning"] = df["Overall_Data_Reliability"].apply(
        lambda v: bool(pd.notna(v) and v < RELIABILITY_MEDIUM_THRESHOLD)
    )
    return df.drop(columns=["Overall_Data_Reliability"])


# backend/generate_ml_features.py has no incremental dedup - ml_features
# can carry several rows for the same (City, Date). This CTE collapses to
# exactly one (the latest-inserted) row per (City, Date) BEFORE joining,
# so the reliability join below can never fan a single prediction_results
# row out into duplicates.
_LATEST_FEATURES_CTE = """
    WITH latest_features AS (
        SELECT DISTINCT ON ("City", "Date") "City", "Date", "Overall_Data_Reliability"
        FROM ml_features
        ORDER BY "City", "Date", id DESC
    )
"""


def get_latest_predictions():

    query = _LATEST_FEATURES_CTE + """
    SELECT DISTINCT ON (p."City") p.*, lf."Overall_Data_Reliability"
    FROM prediction_results p
    LEFT JOIN latest_features lf
        ON lf."City" = p."City" AND lf."Date" = p."Date"
    WHERE p."Date" = (
        SELECT MAX("Date")
        FROM prediction_results
    )
    ORDER BY p."City", p.id DESC;
    """

    df = pd.read_sql(query, engine)
    df = _attach_reliability(df)

    # NaN (e.g. Probability/Model_Used on rows predicted before those
    # columns existed) isn't valid JSON - null is. Without this, any
    # row with a NaN breaks JSON.parse() on the frontend for the whole
    # response.
    df = df.astype(object).where(pd.notna(df), None)

    return df.to_dict(orient="records")


def get_tomorrow_forecast_comparison():
    """Both forecasts for TOMORROW, side by side, per the paper's Table III
    finding that persistence outperforms the trained Random Forest model
    on every primary/walk-forward/sensitivity/robustness check run (see
    ML/reports/*.csv) and the resulting supervisor-review decision
    (Option A, "serve both"):

      - Persistence_Forecast: today's own rule-based risk index (see
        backend/services/live_risk_service.py) under the persistence
        assumption that tomorrow looks like today. This is NOT a new
        computation - it is the existing /prediction/live value, exposed
        here under its forecasting role for tomorrow rather than only as
        a same-day snapshot.
      - ML_Forecast: the frozen Random Forest t+1 prediction (existing
        /prediction/latest value), carrying the note below every time it
        is returned so no caller can present it without the disclaimer.

    Both come from independently-computed, already-existing sources -
    this function only joins them per city. Nothing here retrains,
    reloads, or reinterprets either underlying computation.
    """

    from backend.services.live_risk_service import get_latest_live_risk

    ml_rows = {r["City"]: r for r in get_latest_predictions()}
    persistence_rows = {r["City"]: r for r in get_latest_live_risk()}

    cities = sorted(set(ml_rows) | set(persistence_rows))
    combined = []
    for city in cities:
        ml = ml_rows.get(city)
        persist = persistence_rows.get(city)

        combined.append({
            "City": city,
            "Predicted_For_Date": ml.get("Predicted_For_Date") if ml else None,
            "Persistence_Forecast": persist.get("Risk_Level") if persist else None,
            "Persistence_Basis_Date": persist.get("Date") if persist else None,
            "ML_Forecast": ml.get("Predicted_Risk") if ml else None,
            "ML_Probability": ml.get("Probability") if ml else None,
            "ML_Model_Used": ml.get("Model_Used") if ml else None,
            "ML_Note": (
                "Experimental model \u2014 no demonstrated incremental skill "
                "over persistence."
            ),
        })

    return combined


def get_prediction_history():

    query = _LATEST_FEATURES_CTE + """
    SELECT p.*, lf."Overall_Data_Reliability"
    FROM prediction_results p
    LEFT JOIN latest_features lf
        ON lf."City" = p."City" AND lf."Date" = p."Date"
    ORDER BY p."Date" DESC,
             p."City";
    """

    df = pd.read_sql(query, engine)
    df = _attach_reliability(df)
    df = df.astype(object).where(pd.notna(df), None)

    return df.to_dict(orient="records")