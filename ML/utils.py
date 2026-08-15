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
DATA_DIR = os.path.join(ML_DIR, "data")

BEST_MODEL_PATH = os.path.join(MODELS_DIR, "best_model.pkl")
CITY_ENCODER_PATH = os.path.join(MODELS_DIR, "city_encoder.pkl")
LABEL_ENCODER_PATH = os.path.join(MODELS_DIR, "flood_label_encoder.pkl")

MODEL_COMPARISON_CSV = os.path.join(REPORTS_DIR, "model_comparison.csv")
METRICS_JSON = os.path.join(REPORTS_DIR, "metrics.json")
WALKFORWARD_RESULTS_CSV = os.path.join(REPORTS_DIR, "walkforward_results.csv")

# Raw historical files as originally supplied (same-day rainfall-threshold
# label, interleaved rolling-window split) - kept only as the input the
# t+1 forecasting pipeline (ML/prepare_dataset.py) reads from. Not used
# directly for training any more.
RAW_HISTORICAL_TRAIN_CSV = os.path.join(DATA_DIR, "raw_historical_train.csv")
RAW_HISTORICAL_TEST_CSV = os.path.join(DATA_DIR, "raw_historical_test.csv")

PROCESSED_DATASET_CSV = os.path.join(DATA_DIR, "processed_dataset.csv")

# Chronological split boundary for the primary (non-walk-forward)
# evaluation - see docs/ML_METHODOLOGY_AND_LIMITATIONS.md for why this
# year was chosen (2023 is a partial year, ending mid-June).
TRAIN_YEARS_END = 2019
TEST_YEARS_START = 2020

# Global percentile thresholds for Low/Medium/High/Extreme, fit on
# TRAINING RiskScore only and applied unchanged to test data. Per-city
# thresholds were rejected during methodology review: multiplying a
# whole city's RiskScore series by that city's own constant Vulnerability
# doesn't change within-city percentile rank at all, so Elevation/
# Coastal_Flag would have zero effect on the label under a per-city
# scheme. Global thresholds are the fix.
RISK_PERCENTILE_BOUNDARIES = {
    "Extreme": 0.995,   # top 0.5%
    "High": 0.98,       # next 1.5% (98.0-99.5%)
    "Medium": 0.95,     # next 3% (95.0-98.0%)
}

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
    "Elevation",
    "Coastal_Flag"
]

TARGET_COLUMN = "Flood_Risk"

# Historical daily rainfall, river water level and precise river-distance
# are NOT available for 2010-2023 (verified during methodology review -
# no daily-granularity rainfall source exists in this project for that
# period, and DMC river-gauge collection only began in 2026). They are
# intentionally excluded from FEATURE_COLUMNS rather than approximated.
# Add them here (and to prepare_dataset.py) once enough live history has
# accumulated - see docs/ML_METHODOLOGY_AND_LIMITATIONS.md "Phase 2".

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

# Coastal classification (1 = coastal, 0 = inland), used as one of two
# static Vulnerability components alongside Elevation. Based on general
# published geography of these named towns, not a surveyed gazetteer -
# documented as a stated simplification in
# docs/ML_METHODOLOGY_AND_LIMITATIONS.md. "Mabole" (a Wattala-area suburb
# a few km inland of the Negombo-lagoon coastline) is the single lowest-
# confidence entry here and is worth an independent check if the exact
# classification matters for a specific analysis.
COASTAL_MAP = {
    "Colombo": 1,
    "Mount Lavinia": 1,
    "Kesbewa": 0,
    "Moratuwa": 1,
    "Maharagama": 0,
    "Ratnapura": 0,
    "Kandy": 0,
    "Negombo": 1,
    "Sri Jayewardenepura Kotte": 0,
    "Kalmunai": 1,
    "Trincomalee": 1,
    "Galle": 1,
    "Jaffna": 1,
    "Athurugiriya": 0,
    "Weligama": 1,
    "Matara": 1,
    "Kolonnawa": 0,
    "Gampaha": 0,
    "Puttalam": 1,
    "Badulla": 0,
    "Kalutara": 1,
    "Bentota": 1,
    "Matale": 0,
    "Mannar": 1,
    "Pothuhera": 0,
    "Kurunegala": 0,
    "Mabole": 0,
    "Hatton": 0,
    "Hambantota": 1,
    "Oruwala": 0
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
