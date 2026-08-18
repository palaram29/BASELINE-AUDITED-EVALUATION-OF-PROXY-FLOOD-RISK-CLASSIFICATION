"""
MLOps monitoring/lifecycle API - see docs/MLOPS_INTEGRATION_PLAN.md.

Distinct from backend/routes/ml.py (Model Comparison - Random Forest/
XGBoost/LightGBM metrics, unchanged, still the source of truth for that)
- this router covers production-model lifecycle, drift/data-quality/
prediction monitoring, training history, and promotion/rollback.

There is deliberately no automatic-retraining endpoint here, matching
docs/ML_METHODOLOGY_AND_LIMITATIONS.md's frozen-model policy: retraining
is always a human running `python ML/train_models.py` by hand. The only
mutating endpoint is POST /mlops/models/{version_id}/promote, and it
only ever changes which already-trained, already-reviewed version is
live - it never trains anything.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services import mlops_service

router = APIRouter(prefix="/mlops", tags=["MLOps"])


class PromoteRequest(BaseModel):
    triggered_by: str = "user"


@router.get("/model")
def production_model():
    """The current live model - algorithm, version, status, metrics."""

    try:
        return mlops_service.get_production_model_info()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/models")
def model_versions():
    """Latest registered version per algorithm (the Model Registry view)."""

    return mlops_service.get_all_model_versions()


@router.get("/training-history")
def training_history():
    """Every registered version across every training run, newest first."""

    return mlops_service.get_training_history()


@router.get("/performance")
def performance():
    """Offline evaluation metrics for the production model, explicitly
    tagged with ground_truth_available=false - see
    docs/ML_METHODOLOGY_AND_LIMITATIONS.md §17.1."""

    try:
        return mlops_service.get_performance_metrics()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/drift")
def drift():
    """Per-feature PSI drift score/status vs. the training baseline."""

    return mlops_service.get_drift_status()


@router.get("/data-quality")
def data_quality():
    """Missing-data rate per source plus the composite data reliability
    score."""

    return mlops_service.get_data_quality()


@router.get("/predictions")
def predictions():
    """Live prediction-risk distribution vs. the training-period reference
    distribution."""

    return mlops_service.get_prediction_distribution()


@router.get("/retraining-status")
def retraining_status():
    """Recent drift/quality alert events and whether the latest one is
    still unresolved (i.e. not yet followed by a promotion)."""

    return mlops_service.get_retraining_status()


@router.get("/health")
def health():
    """Aggregate NORMAL/WARNING/CRITICAL rollup, computed from real drift
    and data-quality status - never hardcoded."""

    return mlops_service.get_health_rollup()


@router.post("/models/{version_id}/promote")
def promote(version_id: int, payload: PromoteRequest = PromoteRequest()):
    """Make `version_id` the live production model - the same action
    whether it's a fresh Candidate or an older Archived version
    (rollback). Copies its artifact over ML/models/best_model.pkl."""

    try:
        return mlops_service.promote_model_version(version_id, triggered_by=payload.triggered_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
