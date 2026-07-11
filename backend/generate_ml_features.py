import os
import pandas as pd
import sys
sys.path.append(
    os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )
)

from database.db_connection import get_engine
from backend.utils.logger import logger

engine = get_engine()

# =====================================================
# LOAD WEATHER HISTORY
# =====================================================

df = pd.read_sql(
    """
    SELECT *
    FROM weather_data
    """,
    engine
)

# Convert Date column

if df.empty:
    logger.warning("No weather data found.")
    exit()

df["Date"] = pd.to_datetime(df["Date"])

# Sort data

df = df.sort_values(
    ["City", "Date"]
)

# =====================================================
# GENERATE FEATURES
# =====================================================

feature_rows = []

cities = df["City"].unique()

for city in cities:

    city_df = df[
        df["City"] == city
    ].sort_values("Date")

    # Need at least 3 days

    if len(city_df) < 3:

        logger.warning(
            f"Skipping {city} "
            f"(less than 3 days data)"
        )

        continue

    # Latest 3 days

    latest_3_days = city_df.tail(3)

    rainfall_3day = (
        latest_3_days["Rainfall"].sum()
    )

    avg_temperature = (
        latest_3_days["Temperature"].mean()
    )

    avg_windspeed = (
        latest_3_days["WindSpeed"].mean()
    )

    latest_date = (
        latest_3_days["Date"].max()
    )

    feature_rows.append({

        "Date": latest_date.strftime("%Y-%m-%d"),

        "City": city,

        "Rainfall_3Day": round(
            rainfall_3day,
            2
        ),

        "Avg_Temperature": round(
            avg_temperature,
            2
        ),

        "Avg_WindSpeed": round(
            avg_windspeed,
            2
        )
    })

# =====================================================
# SAVE FEATURES
# =====================================================

features_df = pd.DataFrame(
    feature_rows
)

features_df.to_sql(
    "ml_features",
    engine,
    if_exists="append",
    index=False
)

logger.info("ML Features Saved to PostgreSQL")

logger.info(f"Generated {len(features_df)} ML feature records.")

print("\nPreview:\n")

print(features_df.head())