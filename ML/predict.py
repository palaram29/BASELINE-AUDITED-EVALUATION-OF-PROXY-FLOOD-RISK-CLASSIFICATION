"""
Reusable inference helpers: load whichever model is currently the best
(automatically resolved by ML.utils.resolve_model_paths) and score a
features DataFrame with it.

IMPORTANT (t+1 forecasting): the model is trained to predict Flood_Risk
for the day AFTER the features it's given - see
docs/ML_METHODOLOGY_AND_LIMITATIONS.md. predict_risk() takes features
observed "as of" a Date and returns a Predicted_Risk that applies to
Predicted_For_Date = Date + 1 day, added explicitly to the output so
nothing downstream mistakes this for a same-day/nowcast result. The
label remains a derived flood-risk index, not an observed/confirmed
flood outcome - see the same doc before changing any wording used to
describe it (API responses, dashboard, docs).

backend/predict_flood.py imports load_best_model()/predict_risk() from
here so the prediction API always uses the latest model produced by
ML/train_models.py, without duplicating the elevation/coastal lookup or
feature assembly logic.
"""

import os
import sys
import time
from datetime import timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import joblib
import pandas as pd

from ML.utils import logger, resolve_model_paths, FEATURE_COLUMNS, ELEVATION_MAP, COASTAL_MAP
from ML.model_selector import MODEL_CLASS_TO_NAME


def _display_name(model):
    """RandomForest/XGBoost/LightGBM, not the raw sklearn/xgboost/lightgbm
    class name - so "Model Used" on a live prediction always matches the
    name shown for that same model everywhere else on the dashboard
    (MODEL_REGISTRY keys, the "Best Performing Model" panel, etc.)."""

    class_name = type(model).__name__
    return MODEL_CLASS_TO_NAME.get(class_name, class_name)


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
    model_name = _display_name(model)

    logger.info(f"Loaded model '{model_name}' from {model_path}")

    return model, city_encoder, label_encoder, model_name


def add_elevation(df):
    df = df.copy()
    df["Elevation"] = df["City"].map(ELEVATION_MAP)

    missing = df.loc[df["Elevation"].isna(), "City"].unique()
    if len(missing) > 0:
        logger.warning(f"No elevation mapping for cities: {list(missing)}")

    return df


def add_coastal_flag(df):
    df = df.copy()
    df["Coastal_Flag"] = df["City"].map(COASTAL_MAP)

    missing = df.loc[df["Coastal_Flag"].isna(), "City"].unique()
    if len(missing) > 0:
        logger.warning(f"No Coastal_Flag mapping for cities: {list(missing)}")

    return df


def add_predicted_for_date(df, date_column="Date"):
    """The model predicts the day AFTER `date_column`. Adds
    Predicted_For_Date = date_column + 1 day so every caller gets this
    explicitly rather than having to know/remember the t+1 convention."""

    df = df.copy()
    parsed_date = pd.to_datetime(df[date_column])
    df["Predicted_For_Date"] = (parsed_date + timedelta(days=1)).dt.strftime("%Y-%m-%d")

    return df


def _max_class_probability(model, X):
    """Confidence in the predicted class, or None if the model can't
    produce probabilities."""

    if not hasattr(model, "predict_proba"):
        return [None] * len(X)

    return model.predict_proba(X).max(axis=1).tolist()


def predict_risk(df, model, city_encoder, label_encoder):
    """Score `df` (must contain Date, City, Rainfall_3Day, Avg_Temperature,
    Avg_WindSpeed) and return it with Predicted_Risk (for the NEXT day -
    see Predicted_For_Date), Probability and Model_Used columns added."""

    df = add_elevation(df)
    df = add_coastal_flag(df)
    if "Date" in df.columns:
        df = add_predicted_for_date(df)

    df["City_Encoded"] = city_encoder.transform(df["City"])

    X = df[FEATURE_COLUMNS]
    predictions = model.predict(X)
    df["Predicted_Risk"] = label_encoder.inverse_transform(predictions)
    df["Probability"] = _max_class_probability(model, X)
    df["Model_Used"] = _display_name(model)

    return df


def predict_one(features, model, city_encoder, label_encoder):
    """Score a single {Date, City, Rainfall_3Day, Avg_Temperature,
    Avg_WindSpeed} dict - used by the live /predict endpoint (one city
    at a time).

    Returns {risk, predicted_for_date, confidence, model_used,
    prediction_time_ms}. Pure function: no DB access here, callers fetch
    the feature row themselves (see backend/services/ml_service.py) so
    this module stays DB-agnostic.
    """

    df = pd.DataFrame([features])

    start = time.time()
    scored = predict_risk(df, model, city_encoder, label_encoder)
    elapsed_ms = (time.time() - start) * 1000

    row = scored.iloc[0]
    confidence = row["Probability"]

    return {
        "risk": str(row["Predicted_Risk"]),
        "predicted_for_date": row.get("Predicted_For_Date"),
        "confidence": float(confidence) if pd.notna(confidence) else None,
        "model_used": str(row["Model_Used"]),
        "prediction_time_ms": elapsed_ms,
    }
