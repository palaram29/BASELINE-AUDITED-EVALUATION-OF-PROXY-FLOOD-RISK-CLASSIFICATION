"""
Shared constants, path resolution, logging and data-preparation helpers
for the ML model-comparison pipeline.

This module is the single source of truth for:
  - feature/target column names
  - the city -> elevation lookup
  - where model artifacts and reports live on disk
  - the train/test preprocessing pipeline (reused by training and,
    indirectly, by the prediction API)
"""

import os
import logging
import pandas as pd
from sklearn.preprocessing import LabelEncoder

# =====================================================
# LOGGING
# =====================================================

os.makedirs("logs", exist_ok=True)

logger = logging.getLogger("ML")
logger.setLevel(logging.INFO)

if not logger.handlers:
    _handler = logging.FileHandler("logs/ml_pipeline.log")
    _handler.setFormatter(
        logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
    )
    logger.addHandler(_handler)

# =====================================================
# PATHS
# =====================================================

ML_DIR = os.path.dirname(os.path.abspath(__file__))

MODELS_DIR = os.path.join(ML_DIR, "models")
REPORTS_DIR = os.path.join(ML_DIR, "reports")
CONFUSION_DIR = os.path.join(REPORTS_DIR, "confusion_matrices")

BEST_MODEL_PATH = os.path.join(MODELS_DIR, "best_model.pkl")
CITY_ENCODER_PATH = os.path.join(MODELS_DIR, "city_encoder.pkl")
LABEL_ENCODER_PATH = os.path.join(MODELS_DIR, "flood_label_encoder.pkl")

MODEL_COMPARISON_CSV = os.path.join(REPORTS_DIR, "model_comparison.csv")
METRICS_JSON = os.path.join(REPORTS_DIR, "metrics.json")

# Legacy artifact locations, kept so the system keeps working with the
# model that already exists until the new pipeline is (re)run.
LEGACY_MODEL_PATH = "ML_Training/flood_prediction_model.pkl"
LEGACY_CITY_ENCODER_PATH = "ML_Training/city_encoder.pkl"
LEGACY_LABEL_ENCODER_PATH = "ML_Training/flood_label_encoder.pkl"


def ensure_dirs():
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)
    os.makedirs(CONFUSION_DIR, exist_ok=True)


def resolve_model_paths():
    """
    Resolve (model_path, city_encoder_path, label_encoder_path).

    Prefers the new ML/models/ artifacts produced by ML/train_models.py.
    Falls back to the legacy ML_Training/ artifacts so the prediction API
    keeps working before the new pipeline has been run for the first time.
    """
    if os.path.exists(BEST_MODEL_PATH):
        return BEST_MODEL_PATH, CITY_ENCODER_PATH, LABEL_ENCODER_PATH

    return LEGACY_MODEL_PATH, LEGACY_CITY_ENCODER_PATH, LEGACY_LABEL_ENCODER_PATH


# =====================================================
# FEATURES / TARGET
# =====================================================

FEATURE_COLUMNS = [
    "City_Encoded",
    "Rainfall_3Day",
    "Avg_Temperature",
    "Avg_WindSpeed",
    "Elevation"
]

TARGET_COLUMN = "Flood_Risk"

# Single source of truth for city elevation (metres), used at inference
# time when a features row doesn't already carry an Elevation column.
ELEVATION_MAP = {
    "Colombo": 8,
    "Mount Lavinia": 6,
    "Kesbewa": 12,
    "Moratuwa": 5,
    "Maharagama": 15,
    "Ratnapura": 34,
    "Kandy": 500,
    "Negombo": 2,
    "Sri Jayewardenepura Kotte": 7,
    "Kalmunai": 3,
    "Trincomalee": 5,
    "Galle": 13,
    "Jaffna": 5,
    "Athurugiriya": 10,
    "Weligama": 4,
    "Matara": 6,
    "Kolonnawa": 4,
    "Gampaha": 18,
    "Puttalam": 2,
    "Badulla": 680,
    "Kalutara": 5,
    "Bentota": 3,
    "Matale": 364,
    "Mannar": 3,
    "Pothuhera": 120,
    "Kurunegala": 116,
    "Mabole": 4,
    "Hatton": 1271,
    "Hambantota": 6,
    "Oruwala": 15
}


# =====================================================
# DATA PREPARATION (reused, unchanged behaviour)
# =====================================================

def prepare_data(train_file, test_file):
    """
    Load the train/test CSVs and produce the same feature matrix /
    label vector shape the existing prediction pipeline expects:
    [City_Encoded, Rainfall_3Day, Avg_Temperature, Avg_WindSpeed, Elevation].
    """

    logger.info(f"Loading train data from {train_file}")
    logger.info(f"Loading test data from {test_file}")

    train_df = pd.read_csv(train_file)
    test_df = pd.read_csv(test_file)

    city_encoder = LabelEncoder()

    all_cities = pd.concat(
        [train_df["City"], test_df["City"]],
        ignore_index=True
    )
    city_encoder.fit(all_cities)

    train_df["City_Encoded"] = city_encoder.transform(train_df["City"])
    test_df["City_Encoded"] = city_encoder.transform(test_df["City"])

    X_train = train_df[FEATURE_COLUMNS]
    X_test = test_df[FEATURE_COLUMNS]

    label_encoder = LabelEncoder()
    y_train = label_encoder.fit_transform(train_df[TARGET_COLUMN])
    y_test = label_encoder.transform(test_df[TARGET_COLUMN])

    logger.info(
        f"Prepared data: {len(X_train)} train rows, {len(X_test)} test rows, "
        f"{len(city_encoder.classes_)} cities, "
        f"{len(label_encoder.classes_)} risk classes"
    )

    return X_train, X_test, y_train, y_test, city_encoder, label_encoder


def save_json(data, path):
    import json
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)
