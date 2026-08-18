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
from backend.services import reliability_service
from reliability.config import WEATHER_SOURCE_WEIGHT, RIVER_SOURCE_WEIGHT

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

# Precompute every river source's reliability once (not per city) - see
# reliability_service.compute_all_river_source_reliability. Reused both for
# cities with a mapped station and as the network-wide average fallback for
# unmapped cities.
_river_scores = reliability_service.compute_all_river_source_reliability()
_network_avg_river_reliability = (
    sum(r["reliability_score"] for r in _river_scores.values()) / len(_river_scores)
    if _river_scores else None
)

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

    # Reliability features - computed using only weather/river data up to
    # and including `latest_date` (the same date this feature row is
    # timestamped as), so there is no look-ahead into the future the t+1
    # forecast is trying to predict.
    weather_reliability_result = reliability_service.compute_weather_reliability(
        city, as_of=latest_date
    )
    weather_reliability = (
        weather_reliability_result["reliability_score"]
        if weather_reliability_result else None
    )

    river_source = reliability_service.resolve_river_source_for_city(city)
    if river_source and river_source in _river_scores:
        river_reliability = _river_scores[river_source]["reliability_score"]
    else:
        river_reliability = _network_avg_river_reliability

    if weather_reliability is not None and river_reliability is not None:
        overall_reliability = round(
            WEATHER_SOURCE_WEIGHT * weather_reliability + RIVER_SOURCE_WEIGHT * river_reliability, 4
        )
    else:
        overall_reliability = weather_reliability

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
        ),

        "Weather_Reliability": (
            round(weather_reliability, 4) if weather_reliability is not None else None
        ),

        "River_Reliability": (
            round(river_reliability, 4) if river_reliability is not None else None
        ),

        "Overall_Data_Reliability": overall_reliability,
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