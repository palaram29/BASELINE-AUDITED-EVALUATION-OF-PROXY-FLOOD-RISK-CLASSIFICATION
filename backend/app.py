from fastapi import FastAPI

from backend.routes.weather import router as weather_router
from backend.routes.river import router as river_router
from backend.routes.prediction import router as prediction_router
from backend.routes.dashboard import router as dashboard_router
from backend.routes.stats import router as stats_router
from backend.routes.health import router as health_router
from backend.routes.system import router as system_router
from backend.routes.pipeline import router as pipeline_router
from backend.routes.ml import router as ml_router
from backend.routes.mlops import router as mlops_router
from backend.routes.auth import router as auth_router
from backend.routes.alerts import router as alerts_router
from backend.scheduler import start_scheduler
from database.db_connection import ensure_mlops_tables

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Cloud-Based Flood Prediction System API"
)


@app.on_event("startup")
def _start_live_pipeline_scheduler():
    """Keep weather/river/ML-feature/prediction data live automatically -
    see backend/scheduler.py. Does not train or retrain the model."""

    ensure_mlops_tables()
    start_scheduler()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(weather_router)
app.include_router(river_router)
app.include_router(prediction_router)
app.include_router(dashboard_router)
app.include_router(stats_router)
app.include_router(health_router)
app.include_router(system_router)
app.include_router(pipeline_router)
app.include_router(ml_router)
app.include_router(mlops_router)
app.include_router(auth_router)
app.include_router(alerts_router)

@app.get("/")
def home():

    return {
        "message": "Flood Prediction API is running successfully!"
    }