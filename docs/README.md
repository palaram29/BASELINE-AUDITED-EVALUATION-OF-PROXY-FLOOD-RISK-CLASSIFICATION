# Flood Prediction System — Documentation

This folder documents the whole system: the FastAPI backend, the data
pipeline, the machine-learning module, the MLOps monitoring layer, the
data-reliability layer, and the two React front-ends.

This page also serves as the architecture overview — component map,
data flow, database schema, and how to run everything are below.

| Document | What it covers |
|---|---|
| [API_REFERENCE.md](API_REFERENCE.md) | Every REST endpoint, grouped by router, with auth notes |
| [DATA_PIPELINE.md](DATA_PIPELINE.md) | Weather collection, DMC river-PDF scraping/extraction, river-risk engine, ML feature generation, prediction, and the in-process scheduler |
| [ML_PIPELINE.md](ML_PIPELINE.md) | The `ML/` module — dataset preparation, model comparison/selection, evaluation, walk-forward validation, artifacts, training→registration→promotion workflow |
| [ML_METHODOLOGY_AND_LIMITATIONS.md](ML_METHODOLOGY_AND_LIMITATIONS.md) | How `Flood_Risk` is defined, the t+1 forecasting task, results vs. baselines, and the limitations to state in the dissertation |
| [MLOPS.md](MLOPS.md) | Model-version registry, drift/data-quality/prediction monitoring, retraining alerts, promotion/rollback, and what is still planned |
| [DATA_RELIABILITY_LAYER.md](DATA_RELIABILITY_LAYER.md) | Per-source reliability scoring (completeness/timeliness/validity/history) and the degraded-data research experiment |
| [FRONTENDS.md](FRONTENDS.md) | The operator/research console (`flood-frontend/`) and the public citizen app (`citizen-frontend/`) |

The root [`README.md`](../README.md) is the project's public overview and
install guide; this folder is the design/reference detail behind it.

---

## What the system does

The Flood Prediction System collects real-time weather and river-gauge
data for 30 named locations in Sri Lanka, scores each data source for
reliability, generates machine-learning features, and produces a
**next-day (t+1) flood-risk forecast** per city through a FastAPI REST
API. Two React apps consume that API: a read-only operator/research
console and a public citizen app with personal alerts.

The prediction target, `Flood_Risk`, is a **derived Hazard × Vulnerability
risk index**, not an observed flood-event label — no historical
flood-incident record exists in this project. See
[ML_METHODOLOGY_AND_LIMITATIONS.md](ML_METHODOLOGY_AND_LIMITATIONS.md).

---

## Repository layout

```
Flood_Prediction_System/
├── backend/                     FastAPI app, routes, services, data-collection scripts
│   ├── app.py                   App factory, router registration, CORS, startup hooks
│   ├── config.py                Cities, model-path resolution, MLOps thresholds
│   ├── scheduler.py             In-process hourly pipeline + monitoring + notifications
│   ├── weather_collector.py     WeatherAPI → weather_data
│   ├── river_scraper.py         DMC website poll → PDF download (daemon or --once)
│   ├── extract_river_data.py    PDF → river_data
│   ├── river_risk_engine.py     Highest current river risk summary
│   ├── generate_ml_features.py  weather_data → ml_features (+ reliability columns)
│   ├── predict_flood.py         ml_features → prediction_results (frozen model)
│   ├── routes/                  One module per API area (see API_REFERENCE.md)
│   └── services/                One service per route module
├── reliability/                 Pure, DB-free reliability scoring engine + tests
├── ML/                          Offline model-comparison / selection pipeline
│   ├── prepare_dataset.py       Raw historical CSVs → t+1 train/test datasets
│   ├── train_models.py          Train + compare RF/XGBoost/LightGBM, freeze the winner
│   ├── model_selector.py        Algorithm registry + best-model selection rule
│   ├── evaluate_models.py       Metrics, confusion matrices, comparison table
│   ├── walkforward_validate.py  6-fold rolling-origin validation (+ baselines)
│   ├── baselines.py             Majority / Persistence / Seasonal baselines
│   ├── register_run.py          Register a completed run into the MLOps registry
│   ├── run_reliability_experiments.py  Degraded-data robustness experiment
│   ├── predict.py               Reusable inference (used by backend/predict_flood.py)
│   ├── models/                  Trained + frozen .pkl artifacts, versioned copies
│   └── reports/                 metrics.json, production_model.json, CSVs, matrices
├── ML_Training/                 Legacy single-model trainer (fallback only)
├── database/db_connection.py    Engine + idempotent schema-migration helpers
├── flood-frontend/              React (Vite) operator / research console — port 5173
├── citizen-frontend/            React (Vite) public citizen app — port 5174
├── downloads/  extracted_data/  weather_data/   Runtime output (git-ignored)
├── requirements.txt   .env   README.md
```

---

## High-level architecture

```
          WeatherAPI            DMC river-gauge PDF report
              │                          │
       weather_collector.py       river_scraper.py --once
              │                          │
              ▼                    extract_river_data.py
        weather_data  ◄──────┐           │
              │              │           ▼
              │              │       river_data ──► river_risk_engine.py
              ▼              │           │
   reliability/ scoring ─────┤           │
   (per source)              │           │
              ▼              │           ▼
     data_reliability   generate_ml_features.py  (attaches *_Reliability columns)
                                 │
                                 ▼
                            ml_features
                                 │
                        predict_flood.py  ──►  ML/models/best_model.pkl  (frozen)
                                 │
                                 ▼
                         prediction_results
                                 │
              ┌──────────────────┼─────────────────────┐
              ▼                  ▼                     ▼
      MLOps monitoring    notification_service   REST API (FastAPI)
      (drift / quality)   (risk-rise alerts)     /weather /river /prediction
              │                  │               /dashboard /stats /health
              ▼                  ▼               /reliability /mlops /ml
        ml_* tables       alert_notifications    /auth /alerts /notifications /admin
                                                        │
                                          ┌─────────────┴─────────────┐
                                          ▼                           ▼
                                  flood-frontend/              citizen-frontend/
                                  (operator console)           (public citizen app)
```

`backend/scheduler.py` runs the weather → river → feature → prediction
pipeline every 60 minutes in a background thread started at app startup,
then runs the MLOps monitoring cycle, the reliability scoring pass, and
the notification cycle. Nothing in the live app ever trains or retrains a
model — see [ML_PIPELINE.md](ML_PIPELINE.md) and
[MLOPS.md](MLOPS.md).

---

## Database schema (PostgreSQL)

Tables are created on first write by the collection scripts (`to_sql`) or
by the idempotent `ensure_*` helpers in
[`database/db_connection.py`](../database/db_connection.py), which run on
every app startup and add new columns without dropping data.

### Pipeline data

| Table | Key columns | Written by |
|---|---|---|
| `weather_data` | `Date`, `City`, `Rainfall`, `Temperature`, `WindSpeed` | `weather_collector.py` (dedups per `Date`+`City`) |
| `river_data` | `DateTime` (text), `ReportTimestamp` (real TIMESTAMP), `River`, `Station`, `WaterLevel`, `PreviousWaterLevel`, `AlertLevel`, `MinorFloodLevel`, `MajorFloodLevel`, `Rainfall`, `Status`, `RiverRisk` | `extract_river_data.py` |
| `ml_features` | `Date`, `City`, `Rainfall_3Day`, `Avg_Temperature`, `Avg_WindSpeed`, `Weather_Reliability`, `River_Reliability`, `Overall_Data_Reliability` | `generate_ml_features.py` |
| `prediction_results` | `Date`, `Predicted_For_Date`, `City`, `Rainfall_3Day`, `Avg_Temperature`, `Avg_WindSpeed`, `Predicted_Risk`, `Probability`, `Model_Used` — unique index on (`Date`,`City`) | `predict_flood.py` / `POST /ml/predict` |

`ReportTimestamp` exists because the DMC `DateTime` text (`6-Aug-2026`,
not `06-Aug-2026`) sorts wrong lexicographically; every "latest river
report" query orders by the real timestamp instead.

`Predicted_For_Date` = `Date` + 1 day — the model forecasts the day
*after* the features it is given.

### Accounts & alerts

| Table | Purpose |
|---|---|
| `users` | Citizen-app registration: `full_name`, `email` (unique), `phone`, `password_hash` (bcrypt), `alert_city`, `last_alerted_risk` (notification watermark), `created_at` |
| `alert_notifications` | One row per in-app flood alert delivered to a user; `ON DELETE CASCADE` from `users` |

### Data-reliability layer

| Table | Purpose |
|---|---|
| `data_reliability` | One row per (source_type, source, timestamp) scoring event — the four component scores + combined `reliability_score` / `reliability_level` |
| `data_validation_log` | Audit trail of flagged suspicious/invalid field values (rows are never deleted from `weather_data`/`river_data`) |

### MLOps layer

| Table | Purpose |
|---|---|
| `ml_training_runs` | One row per registered `ML/train_models.py` run |
| `ml_model_versions` | One row per (algorithm, version); `status` = Candidate → Validation → Production → Archived |
| `ml_drift_metrics` | Per-feature PSI snapshots vs. the training baseline |
| `ml_prediction_monitoring` | Live predicted-risk class distribution snapshots |
| `ml_monitoring_metrics` | Missing-data rate / coverage / composite data-quality score, plus low-reliability alerts |
| `ml_retraining_events` | `drift_alert` / `quality_alert` / `promotion` events for a human to act on |

---

## Running the system

### 1. Environment (`.env` in the project root)

```env
WEATHER_API_KEY=your_weatherapi_key

DB_HOST=localhost
DB_PORT=5432
DB_NAME=Flood_prediction
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=generate_with_python_-c_import_secrets_secrets.token_hex(32)

# Optional overrides — defaults shown
# MLFLOW_TRACKING_URI=sqlite:///mlflow.db
# DRIFT_PSI_WARNING_THRESHOLD=0.1
# DRIFT_PSI_CRITICAL_THRESHOLD=0.25
# MISSING_DATA_WARNING_PCT=5
# MISSING_DATA_CRITICAL_PCT=10
# MONITORING_WINDOW_DAYS=7
```

`JWT_SECRET` is required — `auth_service` raises on startup if it is
unset.

### 2. Backend

```bash
pip install -r requirements.txt
python -m uvicorn backend.app:app --reload
```

Serves on `http://127.0.0.1:8000` (`/docs` for Swagger). The scheduler
starts automatically and runs the pipeline once immediately, then hourly.

### 3. Front-ends

```bash
cd flood-frontend   && npm install && npm run dev   # operator console, port 5173
cd citizen-frontend && npm install && npm run dev   # citizen app,      port 5174
```

Backend CORS (`backend/app.py`) allows both `localhost` and `127.0.0.1`
on ports 5173 and 5174.

### 4. Optional: continuous river polling

`POST /system/river` and the scheduler both run `river_scraper.py --once`
(a single check-and-extract cycle). To poll the DMC site every 60 minutes
independently, run the daemon as a long-lived process:

```bash
python backend/river_scraper.py        # daemon mode (blocks forever)
```

### 5. Offline: (re)train the model

See [ML_PIPELINE.md](ML_PIPELINE.md). Never run automatically.

```bash
python ML/prepare_dataset.py
python ML/train_models.py
python ML/walkforward_validate.py
python ML/register_run.py               # then promote via the MLOps page
```
