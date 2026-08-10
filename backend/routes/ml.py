"""
ML model-comparison dashboard API.

Endpoints:
  GET  /models       - metrics for every trained model (RandomForest/XGBoost/LightGBM)
  GET  /best-model    - the currently-selected best model + why it was picked
  POST /train         - retrain and re-compare all models
  POST /predict        - single live prediction for one city, using only the best model
  GET  /history        - prediction history (reuses the existing /prediction/history data)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from backend.services import ml_service
from backend.services.prediction_service import get_prediction_history

router = APIRouter(tags=["ML Dashboard"])


class TrainRequest(BaseModel):
    train_file: Optional[str] = Field(None, description="Override the configured training CSV path.")
    test_file: Optional[str] = Field(None, description="Override the configured test CSV path.")
    metric: Optional[str] = Field(None, description="Metric used to pick the best model (default: f1_score).")


class PredictRequest(BaseModel):
    city: str = Field(..., description="City to predict flood risk for, e.g. 'Colombo'.")


@router.get("/models")
def list_models():
    """Metrics for every model trained in the last run, for the
    Model Overview Cards and Model Comparison Table."""

    try:
        return ml_service.get_all_model_metrics()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/best-model")
def best_model():
    """The current best model's metrics, selection reason, feature
    importance and confusion matrix - for the Best Model panel,
    Feature Importance chart and Confusion Matrix view."""

    try:
        return ml_service.get_best_model_info()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/train")
def train(payload: TrainRequest = TrainRequest()):
    """Retrain and re-compare RandomForest/XGBoost/LightGBM. Blocking -
    returns once training finishes. The dashboard re-fetches /models and
    /best-model afterward to pick up the new results automatically."""

    try:
        result = ml_service.run_training(
            train_file=payload.train_file,
            test_file=payload.test_file,
            metric=payload.metric,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if not result["success"]:
        detail = result["stderr"].strip() or result["stdout"].strip() or result["message"]
        raise HTTPException(status_code=500, detail=detail)

    return result


@router.post("/predict")
def predict(payload: PredictRequest):
    """Predict flood risk for one city using only the current best
    model. Records the result in prediction_results (same table the
    bulk pipeline writes to)."""

    try:
        return ml_service.predict_with_best_model(payload.city)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/history")
def history():
    """Prediction history for the Prediction History table. Reuses the
    existing prediction_service query unchanged - it already selects
    every column, so Probability/Model_Used come along automatically."""

    return get_prediction_history()
