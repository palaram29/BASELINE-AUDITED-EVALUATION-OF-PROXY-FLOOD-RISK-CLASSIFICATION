"""
Service layer for the ML model-comparison dashboard.

Reads training results produced by ML/train_models.py
(ML/reports/metrics.json, ML/reports/production_model.json) and runs a
single live prediction using only the frozen production model. All DB
access for this feature lives here, keeping ML/ itself free of database
dependencies (see ML/predict.py).

There is intentionally no retraining function here - the production
model is trained and frozen offline (`python ML/train_models.py`, run by
a human), never by the live system. See
docs/ML_METHODOLOGY_AND_LIMITATIONS.md "Production deployment: frozen
model policy".
"""

import os
import json

import pandas as pd
from sqlalchemy import text

from database.db_connection import get_engine, ensure_prediction_result_columns
from backend.utils.logger import logger
from ML.utils import METRICS_JSON, PRODUCTION_MODEL_JSON, CITY_ENCODER_PATH, LABEL_ENCODER_PATH
from ML.predict import load_best_model, load_model_from_paths, predict_one
from ML.model_selector import DEFAULT_SELECTION_METRIC
from reliability.scorer import classify as classify_reliability
from reliability.config import RELIABILITY_MEDIUM_THRESHOLD

engine = get_engine()


def _load_metrics():
    """Read ML/reports/metrics.json, the output of the last training run."""

    if not os.path.exists(METRICS_JSON):
        raise FileNotFoundError(
            "No training metrics found yet. Run `python ML/train_models.py` "
            "offline to train and freeze a production model first."
        )

    with open(METRICS_JSON, "r") as f:
        return json.load(f)


def get_all_model_metrics():
    """Return every trained model's metrics, shaped as a list for the
    Model Overview Cards / Comparison Table.

    ML/train_models.py (the production pipeline) only ever trains and
    reports RandomForest/XGBoost/LightGBM - Majority/Persistence/Seasonal
    baselines are a separate, optional methodology check
    (ML/walkforward_validate.py, see
    docs/ML_METHODOLOGY_AND_LIMITATIONS.md) and never reach metrics.json.
    The status != "Baseline" filter below is defensive only, in case
    metrics.json was ever produced by an older run that still included
    them."""

    metrics = _load_metrics()

    return [
        {"name": name, **model_metrics}
        for name, model_metrics in metrics["models"].items()
        if model_metrics.get("status") != "Baseline"
    ]


def _load_production_manifest():
    """Read ML/reports/production_model.json, the frozen production
    model's manifest. Returns None if the model hasn't been frozen yet
    (metrics.json can exist from an older run before this manifest
    existed) - callers treat that as "frozen status unknown", not an
    error, since /best-model must keep working either way."""

    if not os.path.exists(PRODUCTION_MODEL_JSON):
        return None

    with open(PRODUCTION_MODEL_JSON, "r") as f:
        return json.load(f)


def get_best_model_info():
    """Return the frozen production model's metrics plus dashboard
    context (why it was picked, when it was frozen, and its frozen/
    production status)."""

    metrics = _load_metrics()
    best_name = metrics["best_model"]
    best_metrics = metrics["models"][best_name]
    selection_metric = metrics.get("selection_metric", DEFAULT_SELECTION_METRIC)
    manifest = _load_production_manifest()

    # Prefer the exact tie-break reasoning ML/model_selector.py already
    # computed (e.g. "macro-F1 tied with RandomForest, but High-risk
    # recall is X vs Y - preferred for the dangerous-class recall
    # margin"). The generic fallback below is only used when that isn't
    # present (older metrics.json, or a --metric override that bypasses
    # the tie-break hierarchy) - it must NOT claim "Highest <metric>"
    # when the selected model doesn't actually have the highest raw
    # value for that metric, which the tie-break rule can deliberately
    # override (see docs/ML_METHODOLOGY_AND_LIMITATIONS.md).
    reason = metrics.get("selection_reason")
    if not reason:
        metric_value = best_metrics.get(selection_metric)
        reason = (
            f"Selected by {selection_metric.replace('_', ' ').title()} "
            f"({metric_value:.3f})"
            if metric_value is not None else
            f"Selected by {selection_metric.replace('_', ' ').title()}"
        )

    return {
        "name": best_name,
        "reason_selected": reason,
        "selection_metric": selection_metric,
        "trained_at": metrics.get("trained_at"),
        "dataset": metrics.get("dataset"),
        "training_duration_sec": metrics.get("training_duration_sec"),
        "production_status": manifest.get("status") if manifest else None,
        "production_version": manifest.get("version") if manifest else None,
        "frozen_at": manifest.get("frozen_at") if manifest else None,
        "retraining_policy": manifest.get("retraining_policy") if manifest else None,
        **best_metrics,
    }


def _latest_features_for_city(city):
    # Secondary "id" DESC tiebreak: backend/generate_ml_features.py has no
    # incremental dedup, so several rows can share the same (max) "Date" -
    # without this, ORDER BY "Date" DESC LIMIT 1 could non-deterministically
    # pick an OLDER inserted row among the ties (e.g. one predating the
    # Weather_Reliability/River_Reliability/Overall_Data_Reliability
    # columns), silently losing reliability data that genuinely exists.
    query = text("""
        SELECT *
        FROM ml_features
        WHERE "City" = :city
        ORDER BY "Date" DESC, id DESC
        LIMIT 1
    """)

    df = pd.read_sql(query, engine, params={"city": city})

    if df.empty:
        raise ValueError(
            f"No ML features found for '{city}'. "
            "Run the weather/ML-feature pipeline for this city first."
        )

    return df.iloc[0]


def _resolve_production_model():
    """DB-aware production-model lookup: prefers whichever version is
    marked Production in the MLOps registry (ml_model_versions - see
    backend/services/mlops_service.py::promote_model_version), falling
    straight through to the existing file-based load_best_model() if no
    row is promoted yet, the DB is unreachable, or the artifact is
    missing - see docs/MLOPS.md decision 5. This is the
    only place a DB dependency enters model loading; ML/ itself stays
    database-free.

    Encoders aren't versioned per model version (they're fit once per
    training run and shared by all three algorithms in that run), so
    CITY_ENCODER_PATH/LABEL_ENCODER_PATH - the latest run's encoders,
    same as today - are used regardless of which version is Production."""

    try:
        with engine.connect() as conn:
            row = conn.execute(text("""
                SELECT artifact_path FROM ml_model_versions
                WHERE status = 'Production'
                ORDER BY promoted_at DESC LIMIT 1
            """)).mappings().first()
        if row and os.path.exists(row["artifact_path"]):
            return load_model_from_paths(row["artifact_path"], CITY_ENCODER_PATH, LABEL_ENCODER_PATH)
    except Exception as exc:
        logger.warning(
            f"MLOps production-model DB lookup failed, falling back to "
            f"file-based resolution: {exc}"
        )

    return load_best_model()


def predict_with_best_model(city):
    """Run a single live ML flood-risk prediction for `city` using only
    the frozen production model, then record it in prediction_results
    (same table and upsert-by-Date/City pattern as the bulk
    backend/predict_flood.py)."""

    model, city_encoder, label_encoder, model_name = _resolve_production_model()

    row = _latest_features_for_city(city)
    features = {
        "Date": str(row["Date"]),
        "City": city,
        "Rainfall_3Day": float(row["Rainfall_3Day"]),
        "Avg_Temperature": float(row["Avg_Temperature"]),
        "Avg_WindSpeed": float(row["Avg_WindSpeed"]),
    }

    result = predict_one(features, model, city_encoder, label_encoder)

    ensure_prediction_result_columns()

    with engine.begin() as conn:
        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_prediction_results_date_city
            ON prediction_results ("Date", "City")
        """))

        conn.execute(text("""
            INSERT INTO prediction_results (
                "Date", "Predicted_For_Date", "City", "Rainfall_3Day", "Avg_Temperature",
                "Avg_WindSpeed", "Predicted_Risk", "Probability", "Model_Used"
            )
            VALUES (
                :date, :predicted_for_date, :city, :rainfall_3day, :avg_temperature,
                :avg_windspeed, :predicted_risk, :probability, :model_used
            )
            ON CONFLICT ("Date", "City")
            DO UPDATE SET
                "Predicted_For_Date" = EXCLUDED."Predicted_For_Date",
                "Rainfall_3Day" = EXCLUDED."Rainfall_3Day",
                "Avg_Temperature" = EXCLUDED."Avg_Temperature",
                "Avg_WindSpeed" = EXCLUDED."Avg_WindSpeed",
                "Predicted_Risk" = EXCLUDED."Predicted_Risk",
                "Probability" = EXCLUDED."Probability",
                "Model_Used" = EXCLUDED."Model_Used"
        """), {
            "date": str(row["Date"]),
            "predicted_for_date": result["predicted_for_date"],
            "city": city,
            "rainfall_3day": features["Rainfall_3Day"],
            "avg_temperature": features["Avg_Temperature"],
            "avg_windspeed": features["Avg_WindSpeed"],
            "predicted_risk": result["risk"],
            "probability": result["confidence"],
            "model_used": result["model_used"],
        })

    logger.info(
        f"Live prediction for {city}: {result['risk']} for {result['predicted_for_date']} ({model_name})"
    )

    # Data Source Reliability (see backend/services/reliability_service.py),
    # already present on this ml_features row - additive fields only, kept
    # visually/semantically distinct from `confidence` (the model's own
    # probability in its predicted class). Never gates the prediction: a
    # LOW score still returns a normal prediction plus this warning flag
    # for the frontend to render (see §14 of the Data Source Reliability
    # integration).
    overall_reliability = row.get("Overall_Data_Reliability")
    has_reliability = overall_reliability is not None and pd.notna(overall_reliability)

    return {
        "city": city,
        "date": str(row["Date"]),
        "predicted_for_date": result["predicted_for_date"],
        "risk": result["risk"],
        "confidence": result["confidence"],
        "model_used": result["model_used"],
        "prediction_time_ms": result["prediction_time_ms"],
        "data_reliability_score": float(overall_reliability) if has_reliability else None,
        "data_reliability_level": classify_reliability(overall_reliability) if has_reliability else None,
        "degraded_data_warning": bool(has_reliability and overall_reliability < RELIABILITY_MEDIUM_THRESHOLD),
    }
