import time
start = time.time()
from backend.services.system_service import (
    run_weather,
    run_river,
    run_ml,
    run_prediction
)

from backend.utils.logger import logger

def run_full_pipeline():

    logger.info("PIPELINE STARTED")

    weather = run_weather()
    if not weather["success"]:
        logger.error("Weather step failed")
        return {"status": "failed", "step": "weather", "data": weather}

    river = run_river()
    if not river["success"]:
        logger.error("River step failed")
        return {"status": "failed", "step": "river", "data": river}

    ml = run_ml()
    if not ml["success"]:
        logger.error("ML step failed")
        return {"status": "failed", "step": "ml", "data": ml}

    prediction = run_prediction()
    if not prediction["success"]:
        logger.error("Prediction step failed")
        return {"status": "failed", "step": "prediction", "data": prediction}

    logger.info("PIPELINE COMPLETED")

    return {
        "status": "success",
        "weather": weather,
        "river": river,
        "ml_features": ml,
        "prediction": prediction
    }