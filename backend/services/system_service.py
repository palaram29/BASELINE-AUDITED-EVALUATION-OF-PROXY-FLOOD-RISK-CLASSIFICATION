import subprocess
import sys
from backend.utils.logger import logger


def run_weather():

    logger.info("Starting weather collection")

    result = subprocess.run(
        [sys.executable, "backend/weather_collector.py"],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        logger.info("Weather collection completed successfully")
    else:
        logger.error(result.stderr)

    return {
        "success": result.returncode == 0,
        "message": "Weather execution completed",
        "stdout": result.stdout,
        "stderr": result.stderr
    }


def run_river():

    logger.info("Starting river scraping")

    result = subprocess.run(
        [sys.executable, "backend/river_scraper.py", "--once"],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        logger.info("River scraping completed successfully")
    else:
        logger.error(result.stderr)

    return {
        "success": result.returncode == 0,
        "message": "River execution completed",
        "stdout": result.stdout,
        "stderr": result.stderr
    }


def run_ml():

    logger.info("Generating ML features")

    result = subprocess.run(
        [sys.executable, "backend/generate_ml_features.py"],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        logger.info("ML feature generation completed successfully")
    else:
        logger.error(result.stderr)

    return {
        "success": result.returncode == 0,
        "message": "ML feature generation completed",
        "stdout": result.stdout,
        "stderr": result.stderr
    }


def run_prediction():

    logger.info("Running flood prediction")

    result = subprocess.run(
        [sys.executable, "backend/predict_flood.py"],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        logger.info("Prediction completed successfully")
    else:
        logger.error(result.stderr)

    return {
        "success": result.returncode == 0,
        "message": "Prediction completed",
        "stdout": result.stdout,
        "stderr": result.stderr
    }