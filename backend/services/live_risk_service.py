"""
Live same-day ("Today") flood-risk index.

This is the counterpart to the frozen t+1 ML forecast
(backend/services/prediction_service.py / ML/predict.py): where that
predicts Flood_Risk for TOMORROW, this reports the flood-risk index for
TODAY, computed directly from the same documented Hazard x Vulnerability
formula the training labels use (see docs/ML_METHODOLOGY_AND_LIMITATIONS.md
"Hazard x Vulnerability label formula" and ML/prepare_dataset.py).

It is a deterministic rule, NOT a machine-learning model:

    Hazard(t)     = clip((Rainfall_3Day(t) - rmin) / (rmax - rmin), 0, 1)
    Vulnerability = static per-city (0.5*InverseElevation + 0.5*Coastal)
    RiskScore(t)  = Hazard(t) * Vulnerability
    Risk_Level(t) = global-percentile classification of RiskScore(t)

rmin/rmax, the percentile thresholds and the per-city Vulnerability are
FROZEN in ML/reports/label_construction.json (written offline by
ML/export_label_params.py), so this index stays consistent with how the
frozen t+1 model's own labels were built. Nothing here trains, loads or
touches that model.

There is no Probability/confidence here - a rule has none. Data Source
Reliability is attached the same additive way as on t+1 predictions
(see prediction_service._attach_reliability).
"""

import json
import os

import pandas as pd
from sqlalchemy import text

from database.db_connection import get_engine, ensure_live_risk_results_table
from backend.utils.logger import logger
from ML.utils import LABEL_CONSTRUCTION_JSON, ELEVATION_MAP, COASTAL_MAP
from reliability.scorer import classify as classify_reliability
from reliability.config import RELIABILITY_MEDIUM_THRESHOLD

engine = get_engine()

METHOD = "rule_based_hazard_vulnerability"

# Risk ladder, highest first - same order as
# ML/prepare_dataset.py::compute_risk_score_and_labels.classify().
_RISK_ORDER = ("Extreme", "High", "Medium")

_params_cache = None


def _load_params():
    """Read (and cache) the frozen label-construction parameters."""

    global _params_cache
    if _params_cache is not None:
        return _params_cache

    if not os.path.exists(LABEL_CONSTRUCTION_JSON):
        raise FileNotFoundError(
            f"{LABEL_CONSTRUCTION_JSON} not found. Run "
            "`python ML/export_label_params.py` once to freeze the "
            "Hazard x Vulnerability parameters."
        )

    with open(LABEL_CONSTRUCTION_JSON, "r") as f:
        _params_cache = json.load(f)

    return _params_cache


def _fallback_vulnerability(city):
    """Vulnerability for a city not present in the frozen map, computed
    from ML.utils.ELEVATION_MAP / COASTAL_MAP with the same formula and
    the same [0.05, 0.95] elevation-norm clip documented in
    docs/ML_METHODOLOGY_AND_LIMITATIONS.md section 3. Logged because the
    frozen per-city value (fit from the raw historical Elevation column)
    is always preferred when available."""

    if city not in ELEVATION_MAP or city not in COASTAL_MAP:
        return None

    elevations = list(ELEVATION_MAP.values())
    e_min, e_max = min(elevations), max(elevations)
    elevation_norm = (ELEVATION_MAP[city] - e_min) / (e_max - e_min)
    elevation_norm_clipped = min(max(elevation_norm, 0.05), 0.95)
    inverse_elevation = 1 - elevation_norm_clipped

    vulnerability = 0.5 * inverse_elevation + 0.5 * COASTAL_MAP[city]
    logger.warning(
        f"live_risk: '{city}' missing from frozen vulnerability_by_city - "
        f"using ELEVATION_MAP/COASTAL_MAP fallback ({vulnerability:.4f})"
    )
    return vulnerability


def classify_risk_score(score, thresholds):
    """Map a RiskScore to Low/Medium/High/Extreme using the frozen global
    percentile thresholds (same ladder as the dataset label)."""

    for level in _RISK_ORDER:
        if score >= thresholds[level]:
            return level
    return "Low"


def compute_same_day_risk(city, rainfall_3day):
    """Same-day risk for one city given its current 3-day rainfall total.

    Returns {risk_level, risk_score, hazard, vulnerability} or None if the
    city has no known Vulnerability and rainfall is missing."""

    params = _load_params()

    if rainfall_3day is None or pd.isna(rainfall_3day):
        return None

    vulnerability = params["vulnerability_by_city"].get(city)
    if vulnerability is None:
        vulnerability = _fallback_vulnerability(city)
    if vulnerability is None:
        logger.warning(f"live_risk: no Vulnerability for '{city}', skipping")
        return None

    r_min = params["rainfall_min"]
    r_max = params["rainfall_max"]
    hazard = (float(rainfall_3day) - r_min) / (r_max - r_min)
    hazard = min(max(hazard, 0.0), 1.0)

    risk_score = hazard * vulnerability
    risk_level = classify_risk_score(risk_score, params["thresholds"])

    return {
        "risk_level": risk_level,
        "risk_score": round(risk_score, 6),
        "hazard": round(hazard, 6),
        "vulnerability": round(float(vulnerability), 6),
    }


# One latest ml_features row per city. Same latest-inserted-per-(City)
# intent as prediction_service._LATEST_FEATURES_CTE / ml_service's
# "id DESC" tie-break: backend/generate_ml_features.py has no incremental
# dedup, so several rows can share the same max "Date".
_LATEST_FEATURES_QUERY = """
    SELECT DISTINCT ON ("City")
        "City", "Date", "Rainfall_3Day", "Avg_Temperature", "Avg_WindSpeed",
        "Overall_Data_Reliability"
    FROM ml_features
    ORDER BY "City", "Date" DESC, id DESC
"""


def _compute_rows():
    """Compute the current same-day risk for every city that has features.
    Returns a list of dicts (shared by the API response and the DB
    snapshot)."""

    df = pd.read_sql(_LATEST_FEATURES_QUERY, engine)
    if df.empty:
        return []

    rows = []
    for _, r in df.iterrows():
        result = compute_same_day_risk(r["City"], r["Rainfall_3Day"])
        if result is None:
            continue

        overall = r.get("Overall_Data_Reliability")
        has_reliability = overall is not None and pd.notna(overall)

        rows.append({
            "City": r["City"],
            "Date": str(r["Date"]),
            "Rainfall_3Day": _num(r["Rainfall_3Day"]),
            "Avg_Temperature": _num(r["Avg_Temperature"]),
            "Avg_WindSpeed": _num(r["Avg_WindSpeed"]),
            "Hazard": result["hazard"],
            "Vulnerability": result["vulnerability"],
            "Risk_Score": result["risk_score"],
            "Risk_Level": result["risk_level"],
            "Method": METHOD,
            "data_reliability_score": float(overall) if has_reliability else None,
            "data_reliability_level": classify_reliability(overall) if has_reliability else None,
            "degraded_data_warning": bool(has_reliability and overall < RELIABILITY_MEDIUM_THRESHOLD),
        })

    return rows


def _num(value):
    return float(value) if value is not None and pd.notna(value) else None


def get_latest_live_risk():
    """Current same-day flood-risk index for every monitored city
    (recomputed live from the latest weather-derived features - not read
    from the snapshot table, so it is always fresh)."""

    return _compute_rows()


def store_live_risk_snapshot():
    """Upsert the current same-day risk for every city into
    live_risk_results, keyed by ("Date", "City") - one row per city per
    feature date, same upsert pattern as backend/predict_flood.py. Called
    from the pipeline after the t+1 prediction step."""

    ensure_live_risk_results_table()
    rows = _compute_rows()
    if not rows:
        logger.warning("store_live_risk_snapshot: no rows computed, nothing stored")
        return {"stored": 0}

    with engine.begin() as conn:
        for row in rows:
            conn.execute(text("""
                INSERT INTO live_risk_results (
                    "Date", "City", "Rainfall_3Day", "Avg_Temperature", "Avg_WindSpeed",
                    "Hazard", "Vulnerability", "Risk_Score", "Risk_Level", "Method"
                )
                VALUES (
                    :date, :city, :rainfall_3day, :avg_temperature, :avg_windspeed,
                    :hazard, :vulnerability, :risk_score, :risk_level, :method
                )
                ON CONFLICT ("Date", "City")
                DO UPDATE SET
                    "Rainfall_3Day" = EXCLUDED."Rainfall_3Day",
                    "Avg_Temperature" = EXCLUDED."Avg_Temperature",
                    "Avg_WindSpeed" = EXCLUDED."Avg_WindSpeed",
                    "Hazard" = EXCLUDED."Hazard",
                    "Vulnerability" = EXCLUDED."Vulnerability",
                    "Risk_Score" = EXCLUDED."Risk_Score",
                    "Risk_Level" = EXCLUDED."Risk_Level",
                    "Method" = EXCLUDED."Method",
                    computed_at = NOW()
            """), {
                "date": row["Date"],
                "city": row["City"],
                "rainfall_3day": row["Rainfall_3Day"],
                "avg_temperature": row["Avg_Temperature"],
                "avg_windspeed": row["Avg_WindSpeed"],
                "hazard": row["Hazard"],
                "vulnerability": row["Vulnerability"],
                "risk_score": row["Risk_Score"],
                "risk_level": row["Risk_Level"],
                "method": row["Method"],
            })

    logger.info(f"Stored same-day live-risk snapshot for {len(rows)} cities")
    return {"stored": len(rows)}


def get_live_risk_history():
    """Every stored same-day risk snapshot, newest date first."""

    ensure_live_risk_results_table()
    query = """
        SELECT *
        FROM live_risk_results
        ORDER BY "Date" DESC, "City"
    """
    df = pd.read_sql(query, engine)
    df = df.astype(object).where(pd.notna(df), None)
    return df.to_dict(orient="records")
