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

WEATHER_API_URL = "https://api.weatherapi.com/v1/current.json"

# =====================================================
# ML MODEL FILES
# =====================================================
# Automatically resolves to the best model produced by ML/train_models.py
# (ML/models/best_model.pkl), falling back to the legacy ML_Training/
# artifacts until the new pipeline has been run for the first time.

MODEL_FILE, CITY_ENCODER_FILE, LABEL_ENCODER_FILE = resolve_model_paths()

# =====================================================
# ML TRAINING DATA
# =====================================================
# Default location for the train/test CSVs used by POST /train and
# ML/train_models.py's CLI. Override via .env if your dataset lives
# elsewhere; both can also be overridden per-request via the API.

TRAIN_DATA_FILE = os.getenv("TRAIN_DATA_FILE", "ML/data/train_dataset.csv")
TEST_DATA_FILE = os.getenv("TEST_DATA_FILE", "ML/data/test_dataset.csv")

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