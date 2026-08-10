"""
Reusable inference helpers: load whichever model is currently the best
(automatically resolved by ML.utils.resolve_model_paths) and score a
features DataFrame with it.

backend/predict_flood.py imports load_best_model()/predict_risk() from
here so the prediction API always uses the latest model produced by
ML/train_models.py, without duplicating the elevation lookup / feature
assembly logic.
"""

import os
import sys
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import joblib
import pandas as pd

from ML.utils import logger, resolve_model_paths, FEATURE_COLUMNS, ELEVATION_MAP


def load_best_model():
    """Load the current best model + encoders.

    Returns (model, city_encoder, label_encoder, model_name).
    Raises FileNotFoundError if any required artifact is missing.
    """

    model_path, city_encoder_path, label_encoder_path = resolve_model_paths()

    for path in (model_path, city_encoder_path, label_encoder_path):
        if not os.path.exists(path):
            raise FileNotFoundError(f"Required ML artifact not found: {path}")

    model = joblib.load(model_path)
    city_encoder = joblib.load(city_encoder_path)
    label_encoder = joblib.load(label_encoder_path)
    model_name = type(model).__name__

    logger.info(f"Loaded model '{model_name}' from {model_path}")

    return model, city_encoder, label_encoder, model_name


def add_elevation(df):
    df = df.copy()
    df["Elevation"] = df["City"].map(ELEVATION_MAP)

    missing = df.loc[df["Elevation"].isna(), "City"].unique()
    if len(missing) > 0:
        logger.warning(f"No elevation mapping for cities: {list(missing)}")

    return df


def _max_class_probability(model, X):
    """Confidence in the predicted class, or None if the model can't
    produce probabilities."""

    if not hasattr(model, "predict_proba"):
        return [None] * len(X)

    return model.predict_proba(X).max(axis=1).tolist()


def predict_risk(df, model, city_encoder, label_encoder):
    """Score `df` (must contain City, Rainfall_3Day, Avg_Temperature,
    Avg_WindSpeed) and return it with Predicted_Risk, Probability and
    Model_Used columns added."""

    df = add_elevation(df)
    df["City_Encoded"] = city_encoder.transform(df["City"])

    X = df[FEATURE_COLUMNS]
    predictions = model.predict(X)
    df["Predicted_Risk"] = label_encoder.inverse_transform(predictions)
    df["Probability"] = _max_class_probability(model, X)
    df["Model_Used"] = type(model).__name__

    return df


def predict_one(features, model, city_encoder, label_encoder):
    """Score a single {City, Rainfall_3Day, Avg_Temperature, Avg_WindSpeed}
    dict - used by the live /predict endpoint (one city at a time).

    Returns {risk, confidence, model_used, prediction_time_ms}. Pure
    function: no DB access here, callers fetch the feature row themselves
    (see backend/services/ml_service.py) so this module stays DB-agnostic.
    """

    df = pd.DataFrame([features])

    start = time.time()
    scored = predict_risk(df, model, city_encoder, label_encoder)
    elapsed_ms = (time.time() - start) * 1000

    row = scored.iloc[0]
    confidence = row["Probability"]

    return {
        "risk": str(row["Predicted_Risk"]),
        "confidence": float(confidence) if pd.notna(confidence) else None,
        "model_used": str(row["Model_Used"]),
        "prediction_time_ms": elapsed_ms,
    }
