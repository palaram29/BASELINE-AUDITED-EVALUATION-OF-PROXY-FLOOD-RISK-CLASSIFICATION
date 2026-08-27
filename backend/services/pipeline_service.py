import time
start = time.time()
from backend.services.system_service import (
    run_weather,
    run_river,
    run_ml,
    run_prediction
)
from backend.services import live_risk_service

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

    # Snapshot the same-day ("Today") rule-based risk index alongside the
    # t+1 forecast that run_prediction() just wrote. A failure here must
    # not fail the pipeline - the t+1 prediction (the critical output) is
    # already done - so it is isolated, same as the monitoring/
    # notification jobs in backend/scheduler.py.
    try:
        live_risk_service.store_live_risk_snapshot()
    except Exception as exc:
        logger.error(f"Same-day live-risk snapshot failed: {exc}")

    logger.info("PIPELINE COMPLETED")

    return {
        "status": "success",
        "weather": weather,
        "river": river,
        "ml_features": ml,
        "prediction": prediction
    }