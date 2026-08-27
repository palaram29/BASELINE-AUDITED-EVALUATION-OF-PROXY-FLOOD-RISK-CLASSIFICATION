# API Reference

FastAPI app: `backend/app.py` — `http://127.0.0.1:8000`, Swagger at
`/docs`. All responses are JSON.

## Authentication

- **JWT bearer** (`Authorization: Bearer <token>`) protects the citizen
  account/alert endpoints only: `GET/PUT/DELETE /auth/me`,
  `PUT /auth/me/alert-city`, `GET /alerts/me`, and all `/notifications/*`.
  Tokens are HS256, `sub` = user id, 7-day expiry
  (`backend/services/auth_service.py`).
- **No auth** on everything else, including `/mlops/*`, `/reliability/*`,
  and `/admin/users`. The operator console (`flood-frontend/`) is trusted
  read-only tooling with no login of its own; these routers follow that
  same convention rather than adding an admin-auth layer. `/admin/users`
  only ever *reads* the `users` table.

CORS allows `localhost`/`127.0.0.1` on ports `5173` and `5174`.

---

## Public system data

| Method | Path | Description |
|---|---|---|
| GET | `/` | API liveness message |
| GET | `/health/` | `{api, database, ml_model}` — DB connectivity + whether the resolved model file exists |
| GET | `/dashboard/` | `{weather, river, prediction}` — the three "latest" payloads in one call |
| GET | `/stats/` | Counts: weather stations, river stations, latest-day prediction count, high-risk rivers, high-risk predictions (`High`+`Extreme`) |
| GET | `/weather/latest` | All cities' rows for the most recent `Date` |
| GET | `/weather/history` | Every `weather_data` row, newest date first |
| GET | `/river/latest` | All stations from the most recent report (ordered by real `ReportTimestamp`) |
| GET | `/river/history` | Every `river_data` row, newest first |
| GET | `/prediction/latest` | One row per city for the most recent prediction `Date`; each row carries `data_reliability_score` / `data_reliability_level` / `degraded_data_warning` (additive, distinct from `Probability`) |
| GET | `/prediction/history` | Every `prediction_results` row, newest first, same reliability fields attached |

`Predicted_Risk` values are `Low` / `Medium` / `High` / `Extreme`.
`river_data.RiverRisk` uses a separate vocabulary
(`Low`/`Medium`/`High`/`Very High`) mapped from the DMC `Status`
(`Normal`/`Alert`/`Minor Flood`/`Major Flood`) — the two are kept
distinct on purpose.

---

## Pipeline control

| Method | Path | Description |
|---|---|---|
| POST | `/system/weather` | Run `weather_collector.py`, return `{success, stdout, stderr}` |
| POST | `/system/river` | Run `river_scraper.py --once` (single check-and-extract cycle) |
| POST | `/system/ml` | Run `generate_ml_features.py` |
| POST | `/system/predict` | Run `predict_flood.py` (bulk prediction for every city) |
| POST | `/system/run-pipeline` | Run all four steps in order; stops at the first failed step and returns `{status:"failed", step, data}` |
| GET | `/system/status` | The scheduler's real run history: `{last_run_at, last_success_at, last_result, last_error, interval_minutes}` — drives the console's live-status pill |

Each step shells out to the corresponding script with
`subprocess.run(..., capture_output=True)`.

---

## Model comparison dashboard (`backend/routes/ml.py`, no prefix)

Reads the offline training outputs in `ML/reports/`. There is
**no training/retraining endpoint** — see [ML_PIPELINE.md](ML_PIPELINE.md).

| Method | Path | Description |
|---|---|---|
| GET | `/models` | Metrics for every model in the last run (RandomForest/XGBoost/LightGBM) — for the comparison table |
| GET | `/best-model` | The frozen production model's metrics, selection reason, frozen/version status, feature importance, confusion matrix |
| POST | `/predict` | Body `{city}` — one live prediction for that city using **only** the frozen production model; upserts into `prediction_results` |
| GET | `/history` | Prediction history (same data as `/prediction/history`) |

Returns `404` if `ML/reports/metrics.json` does not exist yet (model
never trained).

---

## MLOps monitoring & lifecycle (`/mlops`)

See [MLOPS.md](MLOPS.md). Read model = the `ml_*` Postgres tables; every
endpoint degrades gracefully (empty/`UNKNOWN`, never a 500) if a snapshot
or MLflow is missing.

| Method | Path | Description |
|---|---|---|
| GET | `/mlops/model` | The current live model — registry row if a version has been promoted, else the `production_model.json` manifest |
| GET | `/mlops/models` | Latest registered version per algorithm (Model Registry view) |
| GET | `/mlops/training-history` | Every registered version across every run, newest first |
| GET | `/mlops/performance` | Offline train/test metrics for the production model, tagged `ground_truth_available: false` |
| GET | `/mlops/drift` | Per-feature PSI vs. the training baseline + `overall_status` (NORMAL/WARNING/CRITICAL) |
| GET | `/mlops/data-quality` | Missing-data rate per source, city coverage, composite `data_reliability_score` |
| GET | `/mlops/predictions` | Live predicted-risk class distribution vs. the training-period reference (95/3/1.5/0.5) |
| GET | `/mlops/retraining-status` | Recent drift/quality alert events and whether the latest is unresolved |
| GET | `/mlops/health` | Aggregate NORMAL/WARNING/CRITICAL rollup from drift + data quality + data-source reliability |
| POST | `/mlops/models/{version_id}/promote` | Body `{triggered_by}` — make that version live (fresh promotion *or* rollback); archives the previous Production row and copies its artifact over `ML/models/best_model.pkl` |

---

## Data-source reliability (`/reliability`)

See [DATA_RELIABILITY_LAYER.md](DATA_RELIABILITY_LAYER.md).

| Method | Path | Description |
|---|---|---|
| GET | `/reliability/` | Overall reliability score/level across every scored source |
| GET | `/reliability/summary` | Compact `{overall, weather, river}` rollup for the Dashboard widget |
| GET | `/reliability/sources` | Latest scored row per source; optional `?source_type=weather\|river` |
| GET | `/reliability/history` | `?source=<name>&days=30` — reliability time series for one source |
| GET | `/reliability/validation-flags` | `?source=&limit=50` — recent flagged suspicious/invalid records |

`source` is a City name for weather, or `"River:Station"` for river.
Returns `404` until the pipeline (or scheduler) has scored at least one
source.

---

## Auth & citizen accounts (`/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/auth/cities` | — | The 30 cities available for alert subscription (same list the model predicts on) |
| POST | `/auth/register` | — | Body `{full_name, email, phone?, password (≥8), alert_city}` → `{user, token}`; `400` if the email exists, `422` if the city isn't monitored |
| POST | `/auth/login` | — | Body `{email, password}` → `{user, token}`; `401` on bad credentials |
| GET | `/auth/me` | JWT | Current user profile |
| PUT | `/auth/me` | JWT | Body `{full_name?, phone?, email?}` — omitted fields unchanged; `400` if the new email is taken |
| PUT | `/auth/me/alert-city` | JWT | Body `{alert_city}` — change the subscribed city |
| DELETE | `/auth/me` | JWT | Body `{password}` — permanently delete the account (password re-check so a leaked token alone can't); cascades to `alert_notifications` |

---

## Personal alerts & notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/alerts/me` | JWT | Current flood-alert status for the user's `alert_city`, derived from the latest prediction: `{risk_level, risk_label, is_alert, message, rainfall_3day, predicted_for_date, has_data}` |
| GET | `/notifications` | JWT | In-app flood-alert history, newest first (limit 50) |
| GET | `/notifications/unread-count` | JWT | `{unread}` |
| POST | `/notifications/mark-read` | JWT | Body `{ids?}` — mark those ids read, or all unread if omitted; scoped to the caller |

Notifications are created by `notification_service.run_notification_cycle()`
after every successful pipeline run, only when a user's area risk **rises**
into a higher tier (Moderate/High/Critical). Delivery is in-app only.

---

## Operator user management (`/admin`)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/users` | Every citizen-app registration, newest first: name, email, phone, alert city, notification count + last-notified time, `last_alerted_risk`, and the **current** live risk for their alert city. Read-only, no auth (see top of page). |
