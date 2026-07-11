import os
import pandas as pd
import sys

sys.path.append(
    os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )
)

from backend.utils.logger import logger
from database.db_connection import get_engine

engine = get_engine()

# ==========================================
# LOAD DATA
# ==========================================

df = pd.read_sql(
    """
    SELECT *
    FROM river_data
    """,
    engine
)

if df.empty:
    logger.warning("No river data found in database.")
    exit()

logger.info(f"Loaded {len(df)} river records from PostgreSQL.")

# ==========================================
# RISK SCORES
# ==========================================

risk_scores = {
    "Low": 1,
    "Medium": 2,
    "High": 3,
    "Very High": 4
}

# ==========================================
# FIND HIGHEST RIVER RISK
# ==========================================

highest_score = 0
highest_station = None
highest_status = None

for _, row in df.iterrows():

    river_risk = row["RiverRisk"]

    score = risk_scores.get(river_risk, 0)

    if score > highest_score:

        highest_score = score
        highest_station = row["Station"]
        highest_status = row["Status"]

# ==========================================
# CONVERT SCORE BACK TO RISK
# ==========================================

score_to_risk = {
    1: "Low",
    2: "Medium",
    3: "High",
    4: "Very High"
}

overall_risk = score_to_risk.get(
    highest_score,
    "Unknown"
)

# ==========================================
# OUTPUT
# ==========================================

print("\n===== RIVER RISK SUMMARY =====")

print(f"Overall River Risk : {overall_risk}")

if highest_station:
    print(f"Highest Risk Station : {highest_station}")
    print(f"Station Status : {highest_status}")