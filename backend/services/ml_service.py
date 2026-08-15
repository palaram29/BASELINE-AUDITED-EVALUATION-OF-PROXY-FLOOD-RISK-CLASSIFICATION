"""
Service layer for the ML model-comparison dashboard.

Reads training results produced by ML/train_models.py (ML/reports/metrics.json),
triggers retraining, and runs a single "live" prediction using only the
current best model. All DB access for this feature lives here, keeping
ML/ itself free of database dependencies (see ML/predict.py).
"""

import os
import json
import subprocess

import pandas as pd
from sqlalchemy import text

from database.db_connection import get_engine, ensure_prediction_result_columns
from backend.utils.logger import logger
from backend.config import TRAIN_DATA_FILE, TEST_DATA_FILE
from ML.utils import METRICS_JSON
from ML.predict import load_best_model, predict_one
from ML.model_selector import DEFAULT_SELECTION_METRIC

engine = get_engine()


def _load_metrics():
    """Read ML/reports/metrics.json, the output of the last training run."""

    if not os.path.exists(METRICS_JSON):
        raise FileNotFoundError(
            "No training metrics found yet. Run POST /train first."
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


def get_best_model_info():
    """Return the currently-selected best model's metrics plus dashboard
    context (why it was picked, when it was trained)."""

    metrics = _load_metrics()
    best_name = metrics["best_model"]
    best_metrics = metrics["models"][best_name]
    selection_metric = metrics.get("selection_metric", DEFAULT_SELECTION_METRIC)

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
        **best_metrics,
    }


def run_training(train_file=None, test_file=None, metric=None):
    """Retrain and re-compare all registered models (RandomForest/XGBoost/
    LightGBM) via ML/train_models.py, reusing the exact CLI the rest of
    the system already uses. Blocking - same subprocess pattern as
    system_service.py's other pipeline steps."""

    resolved_train_file = train_file or TRAIN_DATA_FILE
    resolved_test_file = test_file or TEST_DATA_FILE

    for path in (resolved_train_file, resolved_test_file):
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Training data not found at '{path}'. Place your train/test "
                f"CSVs there (or pass train_file/test_file in the request) "
                f"before retraining."
            )

    args = [
        "python", "ML/train_models.py",
        "--train-file", resolved_train_file,
        "--test-file", resolved_test_file,
    ]
    if metric:
        args += ["--metric", metric]

    logger.info(f"Starting model training/comparison: {' '.join(args)}")

    result = subprocess.run(args, capture_output=True, text=True)

    if result.returncode == 0:
        logger.info("Model training/comparison completed successfully")
    else:
        logger.error(result.stderr)

    return {
        "success": result.returncode == 0,
        "message": "Training completed" if result.returncode == 0 else "Training failed",
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def _latest_features_for_city(city):
    query = text("""
        SELECT *
        FROM ml_features
        WHERE "City" = :city
        ORDER BY "Date" DESC
        LIMIT 1
    """)

    df = pd.read_sql(query, engine, params={"city": city})

    if df.empty:
        raise ValueError(
            f"No ML features found for '{city}'. "
            "Run the weather/ML-feature pipeline for this city first."
        )

    return df.iloc[0]


def predict_with_best_model(city):
    """Run a single live prediction for `city` using only the current
    best model, then record it in prediction_results (same table and
    upsert-by-Date/City pattern as the bulk backend/predict_flood.py)."""

    model, city_encoder, label_encoder, model_name = load_best_model()

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

    return {
        "city": city,
        "date": str(row["Date"]),
        "predicted_for_date": result["predicted_for_date"],
        "risk": result["risk"],
        "confidence": result["confidence"],
        "model_used": result["model_used"],
        "prediction_time_ms": result["prediction_time_ms"],
    }
