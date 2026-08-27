# Data Pipeline

The live pipeline turns raw weather and river-gauge data into two
per-city flood-risk outputs — a **next-day (t+1) ML forecast** and a
**same-day ("Today") rule-based risk index**. It runs automatically every
60 minutes and can also be triggered on demand from the API.

```
weather → river → ML features → prediction → same-day risk snapshot
                                    │
                     ┌─────────────┼──────────────┐
              MLOps monitoring  reliability     notifications
                                 scoring
```

Orchestrated by `backend/services/pipeline_service.py::run_full_pipeline()`,
which calls the four data steps in order and stops at the first failure,
then writes the same-day risk snapshot (isolated — a failure there does
not fail the pipeline, since the t+1 forecast is already done).

---

## 1. Weather collection — `backend/weather_collector.py`

- For each of the 30 cities in `backend/config.py::CITIES`, calls
  WeatherAPI (`current.json`) and reads `precip_mm`, `temp_c`,
  `wind_kph`.
- Appends new rows to `weather_data`, **deduplicated per (`Date`, `City`)**
  — so more frequent runs never produce more than one weather row per
  city per day.
- Requires `WEATHER_API_KEY` in `.env`.
- Entry point: `POST /system/weather` → `system_service.run_weather()`
  (shells out and captures stdout/stderr).

## 2. River scraping — `backend/river_scraper.py`

Scrapes the Sri Lanka Disaster Management Centre (DMC) river-water-level
report page, finds the latest PDF link, downloads it to `downloads/`
(tracked in `downloaded_files.txt` so an already-seen PDF is skipped),
then shells out to the extractor and the risk engine.

Two run modes:

| Invocation | Behaviour |
|---|---|
| `python backend/river_scraper.py` | **Daemon** — `check_new_pdf()` once, then poll every 60 min forever. For running as a separate long-lived process. Not started by anything in the repo. |
| `python backend/river_scraper.py --once` | **Single cycle** — one check-and-extract, then exit. This is what `POST /system/river` and the scheduler use, so a pipeline request can never block on the daemon loop. |

## 3. River-data extraction — `backend/extract_river_data.py`

- Opens the newest PDF in `downloads/` with `pdfplumber`, reads page 1.
- Parses the `DATE : … TIME : …` header into `report_datetime` (kept as
  text in `DateTime`) **and** a real `datetime` in `ReportTimestamp`.
- For each station line containing `Normal`/`Alert`/etc., extracts the
  numeric fields (alert/minor/major flood levels, previous & current
  water level, rainfall) and the river/station name, and derives
  `Status` (`Normal`/`Alert`/`Minor Flood`/`Major Flood`).
- Maps `Status` → `RiverRisk` (`Low`/`Medium`/`High`/`Very High`).
- Appends to `river_data`.

**Why `ReportTimestamp` exists:** the DMC `DateTime` text does not
zero-pad the day (`6-Aug-2026`, not `06-Aug-2026`), so ordering `river_data`
by that string is lexicographic, not chronological — `"6-Aug-2026 3:30 PM"`
sorts *after* `"13-Aug-2026 12:30 PM"`. Every "latest river report" query
(`river_service`, `river_risk_engine`, reliability scoring) orders by the
real `ReportTimestamp` column instead. `db_connection.ensure_river_data_timestamp_column()`
backfills it from the text on every startup for any rows still `NULL`.

## 4. River-risk engine — `backend/river_risk_engine.py`

Loads only the **latest report** (`WHERE ReportTimestamp = MAX(...)`) and
prints the single highest current river risk + which station/status it
came from. Console summary only — it does not write to the database. Run
automatically by `river_scraper.py` after each extraction.

## 5. ML feature generation — `backend/generate_ml_features.py`

For each city with ≥ 3 days of weather history:

| Feature | Computation |
|---|---|
| `Rainfall_3Day` | Sum of `Rainfall` over the latest 3 days |
| `Avg_Temperature` | Mean of `Temperature` over the latest 3 days |
| `Avg_WindSpeed` | Mean of `WindSpeed` over the latest 3 days |
| `Weather_Reliability` | `reliability_service.compute_weather_reliability(city, as_of=latest_date)` |
| `River_Reliability` | Reliability of the city's mapped river station, or the network-wide average for unmapped cities |
| `Overall_Data_Reliability` | `0.6 × Weather_Reliability + 0.4 × River_Reliability` |

Reliability columns use only data up to the feature row's own date — no
look-ahead into the day the t+1 forecast is trying to predict. Rows are
appended to `ml_features` (no incremental dedup — downstream queries
collapse to the latest row per (`City`,`Date`) with `DISTINCT ON … id DESC`).

## 6. Prediction — `backend/predict_flood.py`

- Loads the current model via `ML.predict.load_best_model()` —
  `ML/models/best_model.pkl` if it exists, else the legacy
  `ML_Training/` artifacts.
- Scores every `ml_features` row: adds `Elevation` and `Coastal_Flag`
  from the static maps in `ML/utils.py`, encodes `City`, predicts, and
  decodes the label.
- Adds `Predicted_For_Date` = `Date` + 1 day (**the model forecasts the
  next day**), `Probability` (max class probability), and `Model_Used`
  (`RandomForest`/`XGBoost`/`LightGBM`).
- De-duplicates historical `(Date, City)` rows, creates a unique index on
  `(Date, City)`, and upserts into `prediction_results`.

`POST /ml/predict` (`ml_service.predict_with_best_model`) does the same
thing for a single city, and additionally prefers a version marked
`Production` in the MLOps registry over the plain file if one exists.

## 7. Same-day risk snapshot — `backend/services/live_risk_service.py`

After the t+1 prediction step, `run_full_pipeline()` calls
`store_live_risk_snapshot()`. This computes the **same-day ("Today")**
flood-risk index — a deterministic rule, **not** the ML model:

```
Hazard(t)     = clip((Rainfall_3Day(t) − rmin) / (rmax − rmin), 0, 1)
RiskScore(t)  = Hazard(t) × Vulnerability(city)
Risk_Level(t) = global-percentile classification of RiskScore(t)
```

- `rmin`/`rmax`, the thresholds, and the per-city `Vulnerability` are
  **frozen** in `ML/reports/label_construction.json` (written offline by
  `python ML/export_label_params.py`, fit on the 2010-2019 training
  period). This is the exact §3 Hazard × Vulnerability label formula from
  [ML_METHODOLOGY_AND_LIMITATIONS.md](ML_METHODOLOGY_AND_LIMITATIONS.md)
  §19, un-shifted (no t+1).
- Reads the latest `ml_features` row per city (`DISTINCT ON ("City") … id DESC`),
  computes, and **upserts one row per `(Date, City)`** into
  `live_risk_results`. No `Probability` column — a rule has no confidence.
- `GET /prediction/live` recomputes this live on every request (never
  cached) so it always reflects the newest features; `GET /prediction/live/history`
  reads the stored snapshots; `GET /dashboard/` includes it as `live_risk`.

---

## Scheduler — `backend/scheduler.py`

Started from `backend/app.py`'s startup event. On a daemon background
thread, using the `schedule` library (already a dependency):

1. Runs `run_full_pipeline()` **once immediately** at boot, then every
   `PIPELINE_INTERVAL_MINUTES` (60). Each run refreshes weather → river →
   features → t+1 prediction and then the same-day `live_risk_results`
   snapshot.
2. On success, runs, each isolated in its own `try/except` so a failure
   in one never affects pipeline status:
   - `mlops_service.run_monitoring_cycle()` — drift, data-quality, and
     prediction-distribution snapshots; writes a `drift_alert` /
     `quality_alert` row on any threshold breach.
   - `reliability_service.compute_all_reliability()` — re-scores every
     weather and river source.
   - `notification_service.run_notification_cycle()` — raises in-app
     alerts for users whose area risk rose into a higher tier.
3. Records its own run history in memory (`GET /system/status`); this
   resets on restart, which is correct — it describes "is *this* process
   healthy right now".

A single failed run (e.g. a weather-API timeout) is logged and the
scheduler simply tries again next interval; it never crashes the thread.

The scheduler **never trains or retrains a model** — it only refreshes
live data through the already-frozen production model. See
[ML_METHODOLOGY_AND_LIMITATIONS.md](ML_METHODOLOGY_AND_LIMITATIONS.md)
and [MLOPS.md](MLOPS.md).

---

## Live front-end updates

Every front-end screen that shows pipeline data re-fetches on an
interval while open, so a new pipeline run is picked up without a page
reload:

- `flood-frontend/`: `useLiveDashboard`, `useWeather`, `useRiver`,
  `usePrediction`, `useLiveRisk`, `useStatistics` poll their endpoints
  every 30 s. The Dashboard and Prediction pages have a **Today / Tomorrow**
  toggle (same-day `live_risk` index vs t+1 ML forecast). The
  Navbar's live-status pill is derived from `GET /system/status` (the
  scheduler's real last-run outcome), not a hardcoded claim. Real fetched
  values are shown exactly as the API returns them; the `simulate*`
  helpers in `utils/liveData.js` are used only for the offline demo
  fallback.
- `citizen-frontend/`: `useLiveData` / `useNotifications` poll every
  60 s. The Forecast page has the same **Today / Tomorrow** toggle.
