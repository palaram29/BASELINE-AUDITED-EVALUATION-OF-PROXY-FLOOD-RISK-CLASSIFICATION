from fastapi import APIRouter
from backend.services.pipeline_service import run_full_pipeline
from backend.scheduler import get_scheduler_status

router = APIRouter(
    prefix="/system",
    tags=["Pipeline"]
)


@router.post("/run-pipeline")
def run_pipeline():

    return run_full_pipeline()


@router.get("/status")
def pipeline_status():
    """The automatic scheduler's actual run history (backend/scheduler.py),
    for the Pipeline page and the Navbar's live-status pill - not a
    hardcoded "live"/"ready" claim, the real last-run outcome."""

    return get_scheduler_status()