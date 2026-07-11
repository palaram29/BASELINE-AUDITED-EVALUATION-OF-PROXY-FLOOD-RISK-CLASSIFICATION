import pandas as pd
import joblib
import os
import sys
sys.path.append(
    os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )
)
from database.db_connection import get_engine
from backend.utils.logger import logger
from backend.config import (
    MODEL_FILE,
    CITY_ENCODER_FILE,
    LABEL_ENCODER_FILE
)

engine = get_engine()

# =====================================================
# CHECK FILES
# =====================================================

required_files = [
    MODEL_FILE,
    CITY_ENCODER_FILE,
    LABEL_ENCODER_FILE
]

for file in required_files:

    if not os.path.exists(file):

        logger.error(f"Missing file: {file}")

        exit()

# =====================================================
# LOAD MODEL & ENCODERS
# =====================================================

model = joblib.load(MODEL_FILE)

city_encoder = joblib.load(CITY_ENCODER_FILE)

label_encoder = joblib.load(LABEL_ENCODER_FILE)

# =====================================================
# ELEVATION MAPPING
# =====================================================

elevation_map = {

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
# LOAD FEATURES
# =====================================================

df = pd.read_sql(
    """
    SELECT *
    FROM ml_features
    """,
    engine
)

if df.empty:
    logger.warning("No ML features found.")
    exit()

# =====================================================
# ADD ELEVATION
# =====================================================

df["Elevation"] = df["City"].map(
    elevation_map
)

# =====================================================
# ENCODE CITY
# =====================================================

df["City_Encoded"] = city_encoder.transform(
    df["City"]
)

# =====================================================
# PREPARE MODEL INPUT
# =====================================================

X = df[[
    "City_Encoded",
    "Rainfall_3Day",
    "Avg_Temperature",
    "Avg_WindSpeed",
    "Elevation"
]]

# =====================================================
# PREDICT
# =====================================================

predictions = model.predict(X)

df["Predicted_Risk"] = (
    label_encoder.inverse_transform(
        predictions
    )
)

# =====================================================
# SAVE RESULTS
# =====================================================

results = df[[
    "Date",
    "City",
    "Rainfall_3Day",
    "Avg_Temperature",
    "Avg_WindSpeed",
    "Predicted_Risk"
]]

results.to_sql(
    "prediction_results",
    engine,
    if_exists="append",
    index=False
)

# =====================================================
# OUTPUT
# =====================================================

print("\nFlood Prediction Results\n")

print(results)

logger.info("Prediction results saved to PostgreSQL table.")
logger.info(f"Generated {len(results)} flood predictions.")