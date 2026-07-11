from fastapi import FastAPI

from backend.routes.weather import router as weather_router
from backend.routes.river import router as river_router
from backend.routes.prediction import router as prediction_router
from backend.routes.dashboard import router as dashboard_router
from backend.routes.stats import router as stats_router
from backend.routes.health import router as health_router
from backend.routes.system import router as system_router
from backend.routes.pipeline import router as pipeline_router

app = FastAPI(
    title="Flood Prediction API",
    description="Cloud-Based Flood Prediction System API",
    version="1.0.0"
)

app.include_router(weather_router)
app.include_router(river_router)
app.include_router(prediction_router)
app.include_router(dashboard_router)
app.include_router(stats_router)
app.include_router(health_router)
app.include_router(system_router)
app.include_router(pipeline_router)

@app.get("/")
def home():

    return {
        "message": "Flood Prediction API is running successfully!"
    }