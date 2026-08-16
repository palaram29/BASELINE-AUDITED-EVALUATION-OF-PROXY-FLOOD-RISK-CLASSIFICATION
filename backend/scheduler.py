"""
Runs the live data pipeline (weather -> river -> ML features -> frozen-model
prediction) on a fixed interval automatically, in-process with the FastAPI
app - so the dashboard's forecast stays current without anyone having to
manually call POST /system/run-pipeline.

Before this module existed, nothing in the app scheduled anything: the
only polling loop in the codebase (backend/river_scraper.py's
run_daemon()) had to be started by hand as a separate process, and
weather/ML-feature/prediction refresh had no scheduler at all. This uses
the same `schedule` library already in requirements.txt (no new
dependency) on a daemon background thread started from backend/app.py's
startup event, so "run the backend" is now sufficient - no second process
to remember to launch.

Does NOT retrain the model - run_full_pipeline() only refreshes live
weather/river/feature/prediction data through the already-frozen
production model. See docs/ML_METHODOLOGY_AND_LIMITATIONS.md
"Production deployment: frozen model policy".
"""

import threading
import time
from datetime import datetime, timezone

import schedule

from backend.services.pipeline_service import run_full_pipeline
from backend.utils.logger import logger

# Matches river_scraper.py's own polling interval - weather_data dedups
# per (Date, City) so more frequent runs wouldn't produce fresher weather
# than once a day anyway, but river/prediction data benefit from hourly
# refreshes.
PIPELINE_INTERVAL_MINUTES = 60

# In-memory record of the scheduler's own run history, so the frontend
# (Pipeline page, the Navbar's live-status pill) can show what the
# automation actually did instead of a hardcoded "live"/"ready" claim.
# Deliberately in-memory, not persisted - it describes "is the scheduler
# in THIS running process healthy right now", which resets correctly on
# every restart along with the scheduler itself.
_status = {
    "last_run_at": None,
    "last_success_at": None,
    "last_result": None,   # "success" | "failed" | "error" | None (never run yet)
    "last_error": None,
    "interval_minutes": PIPELINE_INTERVAL_MINUTES,
}


def get_scheduler_status():
    return dict(_status)


def _run_pipeline_job():
    logger.info("Scheduled live pipeline run starting")
    _status["last_run_at"] = datetime.now(timezone.utc).isoformat()
    try:
        result = run_full_pipeline()
        if result["status"] == "success":
            logger.info("Scheduled live pipeline run completed successfully")
            _status["last_result"] = "success"
            _status["last_success_at"] = _status["last_run_at"]
            _status["last_error"] = None
        else:
            logger.error(f"Scheduled live pipeline run failed at step '{result.get('step')}'")
            _status["last_result"] = "failed"
            _status["last_error"] = f"Failed at step '{result.get('step')}'"
    except Exception as exc:
        # A single failed run (e.g. a transient weather-API timeout) must
        # not kill the scheduler thread - it should just try again next
        # interval.
        logger.error(f"Scheduled live pipeline run raised an exception: {exc}")
        _status["last_result"] = "error"
        _status["last_error"] = str(exc)


def _run_scheduler_loop():
    while True:
        schedule.run_pending()
        time.sleep(30)


def start_scheduler():
    """Start the background live-pipeline scheduler. Call once, at app
    startup (see backend/app.py)."""

    schedule.every(PIPELINE_INTERVAL_MINUTES).minutes.do(_run_pipeline_job)

    threading.Thread(target=_run_scheduler_loop, daemon=True).start()
    logger.info(f"Live pipeline scheduler started (every {PIPELINE_INTERVAL_MINUTES} min)")

    # Also run once immediately, off the startup path, so a fresh boot
    # doesn't sit on stale data for a full interval before the first
    # automatic refresh.
    threading.Thread(target=_run_pipeline_job, daemon=True).start()
