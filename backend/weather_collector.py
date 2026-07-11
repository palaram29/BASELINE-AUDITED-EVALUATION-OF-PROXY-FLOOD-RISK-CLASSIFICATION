import os
import sys
from datetime import datetime

import pandas as pd
import requests
from dotenv import load_dotenv

sys.path.append(
    os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )
)

from backend.utils.logger import logger
from database.db_connection import get_engine
from backend.config import (
    CITIES,
    WEATHER_API_URL
)

# =====================================================
# WEATHER API CONFIGURATION
# =====================================================

load_dotenv()

API_KEY = os.getenv("WEATHER_API_KEY")

if not API_KEY:
    raise ValueError(
        "WEATHER_API_KEY not found"
    )


# =====================================================
# FILE CONFIGURATION
# =====================================================

today = datetime.now().strftime("%Y-%m-%d")

engine = get_engine()

# =====================================================
# LOAD EXISTING DATA
# =====================================================

try:
    existing_df = pd.read_sql(
        'SELECT * FROM weather_data',
        engine
    )
except Exception:
    existing_df = pd.DataFrame()

if not existing_df.empty:
    existing_df["Date"] = existing_df["Date"].astype(str)
    
# =====================================================
# COLLECT WEATHER DATA
# =====================================================

new_records = []

for city in CITIES:

    try:

        logger.info(f"Collecting weather for {city}...")

        url = (
            f"{WEATHER_API_URL}"
            f"?key={API_KEY}"
            f"&q={city}"
        )

        response = requests.get(url, timeout=30)

        data = response.json()

        rainfall = data["current"]["precip_mm"]

        temperature = data["current"]["temp_c"]

        wind_speed = data["current"]["wind_kph"]

        # Prevent duplicate city-date records
        if not existing_df.empty:

            duplicate = existing_df[
                (existing_df["Date"] == today) &
                (existing_df["City"] == city)
            ]

            if not duplicate.empty:

                logger.info(f"Skipped (already exists): {city}")

                continue

        new_records.append({
            "Date": today,
            "City": city,
            "Rainfall": rainfall,
            "Temperature": temperature,
            "WindSpeed": wind_speed
        })

        logger.info(f"Saved: {city}")

    except Exception as e:

        logger.error(f"Error collecting {city}: {e}")

# =====================================================
# SAVE DATA
# =====================================================

if new_records:

    new_df = pd.DataFrame(new_records)

    new_df.to_sql(
    "weather_data",
    engine,
    if_exists="append",
    index=False
)

    logger.info("Weather data saved to PostgreSQL successfully.")
    
else:

    logger.info("No new weather records to save.")

# =====================================================
# PREVIEW
# =====================================================

print("\nLatest Records:\n")

preview_df = pd.read_sql(
    """
    SELECT *
    FROM weather_data
    ORDER BY id DESC
    LIMIT 10
    """,
    engine
)

print(preview_df)