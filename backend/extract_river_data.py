import pdfplumber
import pandas as pd
import glob
import re
import os
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
# FIND LATEST PDF
# =====================================================

pdf_files = glob.glob("downloads/*.pdf")

if not pdf_files:
    logger.warning("No PDF files found in downloads folder.")
    exit()

PDF_FILE = max(pdf_files, key=os.path.getctime)

logger.info(f"Using PDF: {PDF_FILE}")

# =====================================================
# READ PDF
# =====================================================

with pdfplumber.open(PDF_FILE) as pdf:
    text = pdf.pages[0].extract_text()

lines = text.split("\n")

# =====================================================
# EXTRACT DATE & TIME
# =====================================================

report_datetime = ""

for line in lines:

    if "DATE :" in line and "TIME :" in line:

        date_match = re.search(
            r"DATE\s*:\s*(.*?)\s*TIME",
            line
        )

        time_match = re.search(
            r"TIME\s*:\s*(.*)",
            line
        )

        if date_match and time_match:

            report_datetime = (
                date_match.group(1).strip()
                + " "
                + time_match.group(1).strip()
            )

        break

logger.info(f"Report: {report_datetime}")

# =====================================================
# PROCESS RIVER RECORDS
# =====================================================

records = []

for line in lines:

    # Only process actual river records
    if ("Normal" not in line) and ("Alert" not in line):
        continue

    numbers = re.findall(r'-?\d+\.\d+', line)

    # Most valid rows contain 5 or 6 numeric values
    if len(numbers) < 5:
        continue

    try:

        alert_level = float(numbers[0])
        minor_flood_level = float(numbers[1])
        major_flood_level = float(numbers[2])

        previous_water_level = float(numbers[3])
        water_level = float(numbers[4])
        rainfall = 0.0

        if len(numbers) >= 6:
            rainfall = float(numbers[5])

        # ==========================================
        # STATUS
        # ==========================================

        status = "Normal"

        if "Major Flood" in line:
            status = "Major Flood"

        elif "Minor Flood" in line:
            status = "Minor Flood"

        elif "Alert" in line:
            status = "Alert"

        # ==========================================
        # REMOVE NUMBERS ONLY
        # ==========================================

        text_part = re.sub(
            r'-?\d+\.\d+',
            '',
            line
        )

        # Remove keywords but DO NOT remove letter m
        text_part = (
            text_part
            .replace("Major Flood", "")
            .replace("Minor Flood", "")
            .replace("Alert", "")
            .replace("Normal", "")
            .replace("Falling", "")
            .replace("Rising", "")
        )

        # Remove measurement units only
        text_part = re.sub(r"\s+m\s+", " ", text_part)
        text_part = re.sub(r"\s+ft\s+", " ", text_part)

        text_part = re.sub(r"\s+", " ", text_part)

        text_part = text_part.strip()

        words = text_part.split()

        if len(words) < 3:
            continue

        # River name usually first two words
        river = " ".join(words[:2])

        station = " ".join(words[2:])

        records.append({
            "DateTime": report_datetime,
            "River": river,
            "Station": station,
            "WaterLevel": water_level,
            "PreviousWaterLevel": previous_water_level,
            "AlertLevel": alert_level,
            "MinorFloodLevel": minor_flood_level,
            "MajorFloodLevel": major_flood_level,
            "Rainfall": rainfall,
            "Status": status
        })

    except Exception as e:
        logger.warning(f"Skipped row: {line}")
        continue

# =====================================================
# DATAFRAME
# =====================================================

df = pd.DataFrame(records)

logger.info(f"Records Extracted: {len(df)}")


# =====================================================
# RIVER RISK MAPPING
# =====================================================

def get_river_risk(status):

    if status == "Normal":
        return "Low"

    elif status == "Alert":
        return "Medium"

    elif status == "Minor Flood":
        return "High"

    elif status == "Major Flood":
        return "Very High"

    return "Unknown"

df["RiverRisk"] = df["Status"].apply(get_river_risk)


# =====================================================
# SAVE TO POSTGRESQL
# =====================================================

df.to_sql(
    "river_data",
    engine,
    if_exists="append",
    index=False
)

logger.info("River data saved to PostgreSQL.")
logger.info(f"Inserted {len(df)} river records into PostgreSQL.")

print("\nPreview:\n")
print(df.head(10))