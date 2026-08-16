"""
ML model-comparison dashboard API.

Endpoints:
  GET  /models       - metrics for every trained model (RandomForest/XGBoost/LightGBM)
  GET  /best-model    - the frozen production model's metrics + why it was picked
  POST /predict        - single live prediction for one city, using only the frozen production model
  GET  /history        - prediction history (reuses the existing /prediction/history data)

There is deliberately no training/retraining endpoint here. The production
model is trained offline once (`python ML/train_models.py`), then frozen -
see ML/reports/production_model.json and
docs/ML_METHODOLOGY_AND_LIMITATIONS.md "Production deployment: frozen
model policy". The live API never triggers training.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services import ml_service
from backend.services.prediction_service import get_prediction_history

router = APIRouter(tags=["ML Dashboard"])


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
    """The frozen production model's metrics, selection reason, frozen/
    version status, feature importance and confusion matrix - for the
    Best Model panel, Feature Importance chart and Confusion Matrix view."""

    try:
        return ml_service.get_best_model_info()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/predict")
def predict(payload: PredictRequest):
    """Predict flood risk for one city using only the frozen production
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
