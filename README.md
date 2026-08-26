# 🌊 Flood Prediction System

A **Cloud-Based Flood Prediction System** developed as a Final Year Research Project. The system collects real-time weather and river water level data, processes the data using Machine Learning, and predicts flood risk for selected locations in Sri Lanka through a RESTful API built with FastAPI.

---

## 📌 Project Overview

The Flood Prediction System automates the complete flood prediction workflow by:

- Collecting weather data from WeatherAPI
- Monitoring river water levels from the Sri Lanka Disaster Management Centre (DMC)
- Extracting river data from PDF reports
- Generating machine learning features
- Predicting flood risk using a trained ML model
- Providing REST APIs for frontend integration

---

## 🚀 Features

- 🌦 Real-time Weather Data Collection
- 🌊 River Water Level Monitoring
- 📄 Automatic PDF Extraction from DMC Reports
- 📊 River Risk Analysis
- 🤖 Machine Learning Flood Prediction
- 🗄 PostgreSQL Database Integration
- ⚡ FastAPI REST APIs
- 🔄 Automated Prediction Pipeline
- 📝 Centralized Logging
- 🔐 User Authentication (JWT) & Per-City Alert Subscriptions
- 🔔 Personalized Flood-Risk Alerts (`/alerts/me`)
- 📨 In-App Flood-Alert Notification Centre - a notification is raised for a
  registered user whenever their area's risk *rises* into a higher tier
  (`/notifications`, delivered after every pipeline run - see
  `backend/services/notification_service.py`)
- 🛡 Per-Source Data Reliability Scoring (Completeness/Timeliness/Validity/History)
- 🧪 MLOps Monitoring - model versioning, drift detection, data-quality checks,
  retraining status and a manual model-promotion workflow
- 🖥 **Two React (Vite) front-ends against one API:**
  - **`flood-frontend/`** - operator / research console (Dashboard, Weather, River,
    Prediction, Reliability, MLOps, Pipeline, Statistics, User Management, About) -
    no login, it's read-only tooling; personal alerts/notifications live in
    `citizen-frontend/`. User Management lists everyone registered through
    citizen-frontend, their notification history, and their area's current risk.
  - **`citizen-frontend/`** - public citizen app: your area's flood risk in plain
    language, an interactive risk map (on Home + full-screen at `/map`), weather,
    river levels, next-day forecast, registration with a location, and the in-app
    alert centre. No ML / reliability / pipeline screens. Leaflet is code-split
    and lazily loaded so its ~160 KB never blocks first paint.
- 🗺 Interactive Risk Maps (Leaflet) of monitored cities/rivers
- 📈 Historical Trend Charts (rainfall, risk, reliability, status timeline)

---

## 🛠 Technologies Used

### Backend

- Python 3.13
- FastAPI
- Uvicorn

### Database

- PostgreSQL
- SQLAlchemy

### Machine Learning

- Scikit-learn
- Pandas
- Joblib

### Data Collection

- Requests
- BeautifulSoup4
- PDFPlumber
- Schedule

### Configuration

- Python Dotenv

### Auth

- PyJWT (JWT bearer tokens)
- bcrypt (password hashing)

### Frontend

- React 19 + Vite
- React Router
- Tailwind CSS
- Axios
- Leaflet / React-Leaflet (interactive maps)
- Recharts (charts & trend analysis)

---

## 📂 Project Structure

```
Flood_Prediction_System/
│
├── backend/
│   ├── routes/                    # weather, river, prediction, dashboard, stats,
│   │                               # system, pipeline, health, reliability, mlops,
│   │                               # auth, alerts, notifications, admin
│   ├── services/                  # one service per route module above
│   ├── utils/
│   ├── app.py
│   ├── config.py
│   ├── scheduler.py
│   ├── weather_collector.py
│   ├── river_scraper.py
│   ├── extract_river_data.py
│   ├── river_risk_engine.py
│   ├── generate_ml_features.py
│   └── predict_flood.py
│
├── reliability/                    # pure, DB-free reliability scoring engine
│   ├── completeness.py
│   ├── timeliness.py
│   ├── validity.py
│   ├── historical.py
│   ├── scorer.py
│   ├── degradation.py
│   └── tests/
│
├── flood-frontend/                 # React (Vite) SPA - operator / research console
│   └── src/
│       ├── pages/                  # Dashboard, Weather, River, Prediction,
│       │                           # Statistics, Reliability, MLDashboard, MLOps,
│       │                           # Pipeline, Users, About, NotFound
│       ├── components/             # cards, charts, common, dashboard, layout,
│       │                           # maps, ml, mlops, reliability, tables, weather
│       ├── hooks/
│       ├── routes/
│       └── services/
│
├── citizen-frontend/               # React (Vite) SPA - public citizen app (port 5174)
│   └── src/
│       ├── pages/                  # Home, MapPage, Weather, Rivers, Forecast,
│       │                           # Notifications, Login, Register, Account, NotFound
│       ├── components/             # Layout + nav, RiskHero, LazyRiskMap + RiskMap (Leaflet),
│       │                           # NotificationBell, LocationPicker, EmergencyContacts, common/
│       ├── context/                # AuthContext (own token key)
│       ├── hooks/                  # useAuth, useLiveData, useNotifications
│       ├── utils/                  # risk, riverLevels, guidance, cityCoords, mapData, format
│       ├── data/                   # sriLankaDistricts.json (map polygons)
│       ├── routes/
│       └── services/
│
├── database/
│   ├── db_connection.py
│   └── test_db.py
│
├── ML_Training/                  # legacy training tool (kept for backward compatibility)
│   ├── ML_Training.py
│   ├── flood_prediction_model.pkl
│   ├── city_encoder.pkl
│   └── flood_label_encoder.pkl
│
├── ML/                            # model comparison & selection pipeline
│   ├── train_models.py            # CLI: trains + compares all registered algorithms
│   ├── evaluate_models.py         # metrics, confusion matrices, comparison table
│   ├── model_selector.py          # algorithm registry + best-model selection
│   ├── predict.py                 # reusable inference (used by backend/predict_flood.py)
│   ├── utils.py                   # shared constants, paths, logging, preprocessing
│   ├── models/
│   │   ├── random_forest.pkl
│   │   ├── xgboost.pkl
│   │   ├── lightgbm.pkl
│   │   ├── best_model.pkl         # auto-selected, loaded by the prediction API
│   │   ├── city_encoder.pkl
│   │   └── flood_label_encoder.pkl
│   └── reports/
│       ├── model_comparison.csv
│       ├── metrics.json
│       └── confusion_matrices/
│
├── requirements.txt
├── .env.example
├── README.md
└── .gitignore
```

---

## ⚙️ Installation

### Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/Flood_Prediction_System.git
```

### Navigate into the project

```bash
cd Flood_Prediction_System
```

### Install dependencies

```bash
pip install -r requirements.txt
```

---

## 🔐 Environment Variables

Create a `.env` file in the project root.

Example:

```env
WEATHER_API_KEY=YOUR_WEATHER_API_KEY

DB_HOST=localhost
DB_PORT=5432
DB_NAME=flood_prediction
DB_USER=postgres
DB_PASSWORD=your_password
```

---

## ▶️ Running the Backend

Start the FastAPI server:

```bash
python -m uvicorn backend.app:app --reload
```

Server:

```
http://127.0.0.1:8000
```

Swagger Documentation:

```
http://127.0.0.1:8000/docs
```

---

## 🔄 Prediction Pipeline

The complete workflow is:

```
Weather API
      │
      ▼
Weather Collector
      │
      ▼
PostgreSQL
      │
      ▼
River Scraper
      │
      ▼
PDF Extraction
      │
      ▼
River Risk Engine
      │
      ▼
ML Feature Generator
      │
      ▼
Flood Prediction Model
      │
      ▼
Prediction Results
```

---

## 📡 Available API Endpoints

| Method | Endpoint               | Description               |
| ------ | ---------------------- | ------------------------- |
| GET    | `/`                    | API Home                  |
| GET    | `/docs`                | Swagger Documentation     |
| GET    | `/health`              | System Health             |
| GET    | `/dashboard`           | Dashboard Data            |
| GET    | `/stats`               | Statistics                |
| GET    | `/weather/latest`      | Latest Weather Data       |
| GET    | `/river/latest`        | Latest River Data         |
| GET    | `/prediction/latest`   | Latest Flood Predictions  |
| POST   | `/system/weather`      | Collect Weather Data      |
| POST   | `/system/river`        | Collect River Data        |
| POST   | `/system/ml`           | Generate ML Features      |
| POST   | `/system/predict`      | Predict Flood Risk        |
| POST   | `/system/run-pipeline` | Execute Complete Pipeline |
| GET    | `/reliability`         | Overall Data Reliability  |
| GET    | `/reliability/sources` | Per-Source Reliability    |
| GET    | `/reliability/history` | Reliability Time Series   |
| GET    | `/reliability/summary` | Dashboard Widget Summary  |
| GET    | `/reliability/validation-flags` | Flagged/Suspicious Records |
| GET    | `/mlops/*`             | Model lifecycle, drift, data quality (see `docs/MLOPS_INTEGRATION_PLAN.md`) |
| GET    | `/auth/cities`         | Cities Available for Alert Subscription |
| POST   | `/auth/register`       | Register a New User               |
| POST   | `/auth/login`          | Log In (returns JWT)              |
| GET    | `/auth/me`             | Current User Profile (JWT-protected) |
| PUT    | `/auth/me`             | Edit Full Name / Email / Phone (JWT-protected) |
| DELETE | `/auth/me`             | Permanently Delete Account - requires current password (JWT-protected) |
| PUT    | `/auth/me/alert-city`  | Update the User's Alert City       |
| GET    | `/alerts/me`           | Current User's Flood-Alert Status (JWT-protected) |
| GET    | `/notifications`       | User's In-App Flood-Alert History (JWT-protected) |
| GET    | `/notifications/unread-count` | Unread Alert Count (JWT-protected) |
| POST   | `/notifications/mark-read`    | Mark Alerts Read (JWT-protected)  |
| GET    | `/admin/users`         | Every Registered User + Notification History + Current Risk (operator console, no auth - see below) |

---

## 🖥️ Front-ends

Two independent Vite apps talk to the same FastAPI backend:

| App | Port (dev) | Audience | Run |
| --- | --- | --- | --- |
| `flood-frontend/` | 5173 | Operators / researchers - full console incl. ML, MLOps, pipeline, reliability | `cd flood-frontend && npm install && npm run dev` |
| `citizen-frontend/` | 5174 | Public - area flood risk, risk map, weather, river levels, forecast, alert centre | `cd citizen-frontend && npm install && npm run dev` |

Both are additive: the citizen app only consumes existing public data endpoints plus
`/auth/*` and `/notifications/*`. Backend CORS (`backend/app.py`) allows both origins.
`flood-frontend/` has no login of its own - it's read-only operator tooling; every
account/alert-subscription flow lives in `citizen-frontend/`, the one place a
person actually registers.

### User management (operator console)

`flood-frontend/`'s **User Management** page (`GET /admin/users`) lists every
citizen-frontend registration - name, email, phone, alert city, notification
history, and that city's *current* live risk (not just the tier they were last
notified about) - read-only, no create/edit/delete. Like `/mlops/*` and
`/reliability/*`, this endpoint has no auth check: `flood-frontend/` is trusted
operator tooling with no login of its own, so it follows the same convention
those routers already established rather than adding a separate admin-auth
layer. It never touches the `users` table - registration, login, and alert-city
changes stay exclusively `backend/routes/auth.py`'s job.

### In-app flood-alert notifications

`backend/services/notification_service.py` runs after every successful pipeline cycle
(`backend/scheduler.py`). For each registered user it compares their `alert_city`'s
current risk tier to `users.last_alerted_risk` and inserts an `alert_notifications`
row only when the risk has *risen* into a higher tier (Moderate/High/Critical) - so a
user is not re-alerted every hour while conditions merely stay bad. When conditions
ease back below Moderate the watermark is cleared, so a later rise alerts again.
Delivery is in-app only (the citizen app's bell + `/alerts` screen); nothing is
emailed or texted.

---

## 🛡️ Data Source Reliability

Full design, architecture, and the degraded-data experiment results are documented in [`docs/DATA_RELIABILITY_LAYER.md`](docs/DATA_RELIABILITY_LAYER.md).

A per-source reliability layer sits between raw data collection and the ML pipeline, scoring every
environmental data source (one per City for weather, one per River:Station for river) on four
components:

```
Reliability Score = 0.25 × Completeness
                   + 0.25 × Timeliness
                   + 0.25 × Validity
                   + 0.25 × Historical Reliability
```

classified as **HIGH** (≥0.80), **MEDIUM** (≥0.60) or **LOW** (below 0.60). All weights and
thresholds are configurable via environment variables - see `reliability/config.py`.

- **`reliability/`** - the pure, DB-free scoring engine (completeness/timeliness/validity/
  historical/scorer/degradation), shared by the live backend, the ML training pipeline and the
  research experiment runner. Distinct from `backend/services/mlops_service.py`'s simpler,
  pre-existing `data_reliability_score` (an aggregate missing-rate metric, unaffected/unchanged) -
  this is the per-source, four-component weighted layer.
- **`backend/services/reliability_service.py`** / **`backend/routes/reliability.py`** - computes
  and persists scores into the `data_reliability` / `data_validation_log` PostgreSQL tables (see
  `database/db_connection.py::ensure_data_reliability_tables`), exposed via `GET /reliability/*`.
  Suspicious/invalid records are flagged for audit, never deleted from `weather_data`/`river_data`.
  Runs automatically after every scheduled pipeline cycle (`backend/scheduler.py`), and low scores
  are logged as monitoring alerts (`ml_monitoring_metrics`, surfaced via `GET /mlops/health`).
- **`backend/generate_ml_features.py`** attaches `Weather_Reliability` / `River_Reliability` /
  `Overall_Data_Reliability` to every `ml_features` row, computed only from data available up to
  that row's own date (no look-ahead leakage).
- **Dashboard**: a compact reliability widget on the main Dashboard and inline on every prediction
  row/live-prediction result (clearly separate from the model's own probability - a data-quality
  signal, never model confidence), plus a full `/reliability` page with per-source detail, a
  history chart and the validation-flags audit table.

### Baseline vs. reliability-aware models

`ML/train_models.py` can train two feature configurations - **baseline** (the original
`Rainfall_3Day, Avg_Temperature, Avg_WindSpeed, Elevation, Coastal_Flag`) and
**reliability_aware** (adds `Weather_Reliability, River_Reliability, Overall_Data_Reliability`) -
for all three algorithms, to test whether reliability-aware features improve robustness:

```bash
python ML/train_models.py                                  # baseline (default, unchanged production paths)
python ML/train_models.py --feature-set reliability_aware   # writes to ML/models/reliability_aware/
```

The live prediction pipeline always serves the **baseline** model by default (frozen-model
policy, unchanged) - a reliability-aware model only becomes production via the existing manual
`POST /mlops/models/{id}/promote` workflow, once the experiment results below justify it.

### Degraded-data research experiments

```bash
python ML/run_reliability_experiments.py
```

Trains all 3 algorithms × 2 feature configurations on the same (undegraded) training split, then
evaluates each on 6 controlled test-set conditions - `normal`, `missing_10/20/30`, `delayed`,
`invalid` (see `reliability/degradation.py` - all in-memory, non-destructive; `ML/data/*.csv` and
`ML/models/` are never touched). Writes real, computed results (accuracy/precision/recall/
F1/ROC-AUC/confusion matrix per condition) to
`ML/reports/reliability_experiments/comparison_table.csv` (+ `.json`), plus a printed pivot table
comparing baseline vs. reliability-aware for each condition/algorithm - this is the evidence for
(or against) the paper's research hypothesis that reliability-aware processing improves robustness
under degraded data.

### Reproducing the full research evaluation

```bash
python ML/prepare_dataset.py                                # rebuild train/test CSVs with reliability features
python ML/train_models.py                                    # baseline
python ML/train_models.py --feature-set reliability_aware     # reliability-aware
python ML/run_reliability_experiments.py                      # degraded-data comparison
```

### Unit tests

```bash
python -m reliability.tests.test_completeness
python -m reliability.tests.test_timeliness
python -m reliability.tests.test_validity
python -m reliability.tests.test_historical
python -m reliability.tests.test_scorer
python -m reliability.tests.test_degradation
```

Plain-assertion scripts (no new dependency) that also happen to be pytest-discoverable, matching
the project's existing lightweight test-script convention (`database/test_db.py`).

---

## 🧠 Machine Learning

### Input Features

**Baseline** (production, default):

- City
- 3-Day Rainfall
- Average Temperature
- Average Wind Speed
- Elevation
- Coastal Flag

**Reliability-aware** (research configuration, adds):

- Weather Reliability
- River Reliability
- Overall Data Reliability

### Output

- Low Risk
- Medium Risk
- High Risk
- Extreme Risk

### Model Comparison & Selection

The `ML/` module trains and compares **Random Forest**, **XGBoost**, and **LightGBM**
on the exact same preprocessing pipeline and train/test split, then automatically
saves the best-performing model for the prediction API to use.

Run it with your training/test CSVs (same columns as before: `City, Rainfall_3Day,
Avg_Temperature, Avg_WindSpeed, Elevation, Flood_Risk`):

```bash
python ML/train_models.py --train-file path/to/train_dataset.csv --test-file path/to/test_dataset.csv
```

Optionally choose the metric used to pick the winner (default `f1_score`):

```bash
python ML/train_models.py --train-file train.csv --test-file test.csv --metric roc_auc
```

This produces, per model: **Accuracy, Precision, Recall, F1 Score, ROC-AUC, Confusion
Matrix, Training Time, Prediction Time**, written to `ML/reports/model_comparison.csv`
and `ML/reports/metrics.json`, plus a confusion-matrix image/CSV per model under
`ML/reports/confusion_matrices/`. Every trained model is saved individually under
`ML/models/`, and the winner is additionally saved as `ML/models/best_model.pkl`
along with `city_encoder.pkl` / `flood_label_encoder.pkl`.

`backend/predict_flood.py` (and `POST /system/predict`) automatically load
`ML/models/best_model.pkl` — no code changes needed after retraining. If that file
doesn't exist yet, the system falls back to the legacy model in `ML_Training/` so
existing deployments keep working unmodified.

Adding a new algorithm (e.g. CatBoost) later only requires adding one entry to
`MODEL_REGISTRY` in `ML/model_selector.py`.

---

## 📊 Database

The project uses PostgreSQL to store:

- Weather Data
- River Data
- ML Features
- Flood Prediction Results
- Users (registration / login / `alert_city` / `last_alerted_risk`)
- Alert Notifications (in-app flood-alert history)

---

## 📈 Future Improvements

- SMS / email / push delivery for flood alerts — the citizen app now has an
  in-app notification centre (`/notifications`, raised on a risk-tier rise),
  but alerts are not yet delivered outside the app
- Push-alerting (email/Slack/GitHub issue) when drift or data-quality
  breaches a threshold — today those events land in
  `GET /mlops/retraining-status` for a human to check on request, there's
  no automatic notification yet
- Docker/CI-CD deployment stack for the backend + frontend — see
  [`docs/MLOPS_INTEGRATION_PLAN.md`](docs/MLOPS_INTEGRATION_PLAN.md) §0
  for exactly what's already built vs. still planned

---

## 👨‍💻 Author

**Palaram Ramanathan**

Final Year Undergraduate

BSc (Hons) Computer Science

---

## 📄 License

This project was developed for academic and research purposes.
