import os
import sys
from dotenv import load_dotenv

sys.path.append(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)

load_dotenv()

from ML.utils import resolve_model_paths

# =====================================================
# WEATHER API
# =====================================================

# forecast.json, not current.json: current.json's "current" block is an
# instantaneous reading (rain falling in roughly the last hour), while
# training data (Rainfall_3Day in ML/data/processed_dataset.csv) was built
# from actual DAILY rainfall totals. forecast.json (days=1) additionally
# returns forecast.forecastday[0].day.totalprecip_mm - the accumulating
# total for the current calendar day - which matches that "daily total"
# semantics far more closely than a single instantaneous reading. See
# backend/weather_collector.py and docs/DATA_PIPELINE.md.
WEATHER_API_URL = "https://api.weatherapi.com/v1/forecast.json"

# =====================================================
# ML MODEL FILES
# =====================================================
# Automatically resolves to the frozen production model produced by
# ML/train_models.py (ML/models/best_model.pkl - see
# ML/reports/production_model.json for its frozen manifest), falling
# back to the legacy ML_Training/ artifacts until the new pipeline has
# been run for the first time. The live system only ever reads this
# model; it is never retrained automatically - see
# docs/ML_METHODOLOGY_AND_LIMITATIONS.md "Production deployment: frozen
# model policy".

MODEL_FILE, CITY_ENCODER_FILE, LABEL_ENCODER_FILE = resolve_model_paths()

# =====================================================
# ML TRAINING DATA
# =====================================================
# Default location for the train/test CSVs used by ML/train_models.py's
# CLI - an offline, manually-run script only. Not used by any live API
# endpoint. Override via .env if your dataset lives elsewhere.

TRAIN_DATA_FILE = os.getenv("TRAIN_DATA_FILE", "ML/data/train_dataset.csv")
TEST_DATA_FILE = os.getenv("TEST_DATA_FILE", "ML/data/test_dataset.csv")

# =====================================================
# MLOPS MONITORING
# =====================================================
# See docs/MLOPS.md. PSI (Population Stability Index)
# thresholds below are the standard literature convention: <0.1 = no
# meaningful shift, 0.1-0.25 = moderate shift worth a look, >0.25 =
# significant shift. All configurable so they can be recalibrated once
# enough live data volume exists to justify tighter/looser bands, without
# a code change.

MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "sqlite:///mlflow.db")

DRIFT_PSI_WARNING_THRESHOLD = float(os.getenv("DRIFT_PSI_WARNING_THRESHOLD", "0.1"))
DRIFT_PSI_CRITICAL_THRESHOLD = float(os.getenv("DRIFT_PSI_CRITICAL_THRESHOLD", "0.25"))

# Smoothing floor for the PSI actual-proportion term. PSI sums
# (a_i - e_i) * ln(a_i / e_i) over bins, so a bin that receives no live
# observations would make the logarithm undefined. The expected
# proportion e_i cannot be zero here because the baseline bins are the
# training distribution's own quintile edges, giving e_i = 0.2 by
# construction; only the actual proportion a_i needs a floor. The value
# is small enough not to perturb a populated bin and large enough to keep
# an empty bin finite: with the seven-day monitoring window an empty bin
# contributes roughly (0 - 0.2) * ln(1e-6 / 0.2), a large but bounded
# term that correctly registers as critical drift rather than crashing.
DRIFT_PSI_EPSILON = float(os.getenv("DRIFT_PSI_EPSILON", "1e-6"))

# Number of baseline bins. Quintiles are used, so the expected proportion
# per bin is exactly 1 / DRIFT_PSI_BINS by construction.
DRIFT_PSI_BINS = int(os.getenv("DRIFT_PSI_BINS", "5"))

MISSING_DATA_WARNING_PCT = float(os.getenv("MISSING_DATA_WARNING_PCT", "5"))
MISSING_DATA_CRITICAL_PCT = float(os.getenv("MISSING_DATA_CRITICAL_PCT", "10"))

# Rolling window (days) used for drift/prediction-distribution/missing-
# data monitoring queries against live tables.
MONITORING_WINDOW_DAYS = int(os.getenv("MONITORING_WINDOW_DAYS", "7"))

# =====================================================
# CITIES
# =====================================================

CITIES = [
    "Colombo",
    "Mount Lavinia",
    "Kesbewa",
    "Moratuwa",
    "Maharagama",
    "Ratnapura",
    "Kandy",
    "Negombo",
    "Sri Jayewardenepura Kotte",
    "Kalmunai",
    "Trincomalee",
    "Galle",
    "Jaffna",
    "Athurugiriya",
    "Weligama",
    "Matara",
    "Kolonnawa",
    "Gampaha",
    "Puttalam",
    "Badulla",
    "Kalutara",
    "Bentota",
    "Matale",
    "Mannar",
    "Pothuhera",
    "Kurunegala",
    "Mabole",
    "Hatton",
    "Hambantota",
    "Oruwala"
]