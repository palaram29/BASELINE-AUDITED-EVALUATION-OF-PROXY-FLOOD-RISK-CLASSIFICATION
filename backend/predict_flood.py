import pandas as pd
import os
import sys
from sqlalchemy import text
sys.path.append(
    os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )
)
from database.db_connection import get_engine, ensure_prediction_result_columns
from backend.utils.logger import logger
from ML.predict import load_best_model, predict_risk

engine = get_engine()
ensure_prediction_result_columns()

# =====================================================
# LOAD MODEL & ENCODERS (automatically the current best model,
# see ML/train_models.py and ML/utils.resolve_model_paths)
# =====================================================

try:
    model, city_encoder, label_encoder, model_name = load_best_model()
    logger.info(f"Using model: {model_name}")
except FileNotFoundError as e:
    logger.error(str(e))
    exit()

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
# PREDICT
# =====================================================

try:
    df = predict_risk(df, model, city_encoder, label_encoder)
except Exception as e:
    logger.error(f"Prediction failed: {e}")
    exit()

# =====================================================
# SAVE RESULTS
# =====================================================

results = df[[
    "Date",
    "Predicted_For_Date",
    "City",
    "Rainfall_3Day",
    "Avg_Temperature",
    "Avg_WindSpeed",
    "Predicted_Risk",
    "Probability",
    "Model_Used"
]]

with engine.begin() as conn:
    conn.execute(text("""
        DELETE FROM prediction_results
        WHERE id IN (
            SELECT id
            FROM (
                SELECT id,
                       row_number() OVER (
                           PARTITION BY "Date", "City"
                           ORDER BY id
                       ) AS rn
                FROM prediction_results
            ) AS ranked
            WHERE rn > 1
        )
    """))

    conn.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_prediction_results_date_city
        ON prediction_results ("Date", "City")
    """))

    for _, row in results.iterrows():
        conn.execute(text("""
            INSERT INTO prediction_results (
                "Date",
                "Predicted_For_Date",
                "City",
                "Rainfall_3Day",
                "Avg_Temperature",
                "Avg_WindSpeed",
                "Predicted_Risk",
                "Probability",
                "Model_Used"
            )
            VALUES (
                :date,
                :predicted_for_date,
                :city,
                :rainfall_3day,
                :avg_temperature,
                :avg_windspeed,
                :predicted_risk,
                :probability,
                :model_used
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
            "predicted_for_date": str(row["Predicted_For_Date"]),
            "city": row["City"],
            "rainfall_3day": float(row["Rainfall_3Day"]),
            "avg_temperature": float(row["Avg_Temperature"]),
            "avg_windspeed": float(row["Avg_WindSpeed"]),
            "predicted_risk": row["Predicted_Risk"],
            "probability": float(row["Probability"]) if pd.notna(row["Probability"]) else None,
            "model_used": row["Model_Used"]
        })

# =====================================================
# OUTPUT
# =====================================================

print("\nFlood Prediction Results\n")

print(results)

logger.info("Prediction results saved to PostgreSQL table.")
logger.info(f"Generated {len(results)} flood predictions.")