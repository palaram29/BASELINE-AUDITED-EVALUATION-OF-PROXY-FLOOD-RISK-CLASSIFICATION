from fastapi import APIRouter
from backend.services.pipeline_service import run_full_pipeline

router = APIRouter(
    prefix="/system",
    tags=["Pipeline"]
)


@router.post("/run-pipeline")
def run_pipeline():

    return run_full_pipeline()