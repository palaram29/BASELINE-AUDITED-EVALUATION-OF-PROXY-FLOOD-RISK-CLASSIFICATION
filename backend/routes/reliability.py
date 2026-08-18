"""
Data Source Reliability API - see backend/services/reliability_service.py.

Distinct from backend/routes/mlops.py's GET /mlops/data-quality (a simpler,
pre-existing aggregate missing-rate score) - this router covers the
per-source, four-component (Completeness/Timeliness/Validity/Historical)
weighted reliability layer.
"""

from fastapi import APIRouter, HTTPException

from backend.services import reliability_service

router = APIRouter(prefix="/reliability", tags=["Data Reliability"])


@router.get("/")
def overall():
    """Overall reliability score/level across every scored source."""

    try:
        return reliability_service.get_overall_reliability()
    except reliability_service.ReliabilityError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/summary")
def summary():
    """Compact {overall, weather, river} rollup for the main Dashboard's
    Data Reliability widget."""

    try:
        return reliability_service.get_reliability_summary()
    except reliability_service.ReliabilityError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/sources")
def sources(source_type: str | None = None):
    """Latest scored row per source (City for weather, River:Station for
    river), optionally filtered by source_type."""

    return reliability_service.get_source_reliability(source_type=source_type)


@router.get("/history")
def history(source: str, days: int = 30):
    """Time series of reliability scores for one source."""

    return reliability_service.get_reliability_history(source, days=days)


@router.get("/validation-flags")
def validation_flags(source: str | None = None, limit: int = 50):
    """Recent suspicious/invalid records flagged by the validity checks -
    the audit trail required by "mark as invalid, never silently delete"
    (original weather_data/river_data rows are untouched)."""

    return reliability_service.get_recent_validation_flags(source=source, limit=limit)
