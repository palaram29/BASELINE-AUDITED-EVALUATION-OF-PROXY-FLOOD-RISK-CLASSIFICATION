# MLOps — Monitoring & Model Lifecycle

This document describes the MLOps layer: how the system tracks the
production model, watches the live data flowing through it, and lets a
human roll a model version forward or back. It also records the design
rationale (written to be lifted into the dissertation's system-design
chapter) and what is deliberately still out of scope.

MLOps here is separate from application DevOps. DevOps manages whether the
FastAPI service is running and deployable. MLOps manages the *model and
the data flowing through it* — the service can be "up" while the model
silently degrades because the live weather distribution has drifted away
from the 2010–2023 distribution it was fit on. The
[frozen-model policy](ML_METHODOLOGY_AND_LIMITATIONS.md) exists precisely
because model changes are decoupled from application deploys; this layer
gives the human who decides whether to re-run `ML/train_models.py` the
evidence to decide.

---

## Architecture

```
OFFLINE (human-run)
  ML/train_models.py  ──►  MLflow tracking (sqlite:///mlflow.db)   [audit trail]
        │                  + ML/reports/{metrics,production_model,feature_baseline}.json
        ▼
  ML/register_run.py  ──►  ml_training_runs + ml_model_versions (status=Candidate)
                           + versioned artifact copies under ML/models/versions/

LIVE (FastAPI)
  scheduler → pipeline success → mlops_service.run_monitoring_cycle()
        │                            │
        │                            ├─ feature drift  (PSI vs feature_baseline.json) → ml_drift_metrics
        │                            ├─ data quality   (missing rate, coverage)       → ml_monitoring_metrics
        │                            ├─ prediction dist (live vs training reference)   → ml_prediction_monitoring
        │                            └─ threshold breach → ml_retraining_events (drift_alert / quality_alert)
        ▼
  GET /mlops/*  ──►  flood-frontend/ MLOps page

PROMOTION (human action only)
  POST /mlops/models/{id}/promote  ──►  flips one ml_model_versions row to Production,
                                        archives the previous one,
                                        copies its artifact over ML/models/best_model.pkl
```

**Postgres is the source of truth the live app reads.** MLflow is kept as
a best-effort audit mirror only — if it is unreachable, training,
registration, and promotion all still succeed.

---

## Requirement → mechanism → data source

| # | Requirement | Mechanism | Data source | Status |
|---|---|---|---|---|
| 1 | Production model version | `ml_model_versions.status='Production'`, or the `production_model.json` manifest until a version is promoted | Postgres / JSON | Built |
| 2 | Feature distributions | Live `Rainfall_3Day`/`Avg_Temperature`/`Avg_WindSpeed` vs. the frozen training baseline | `ml_features`, `feature_baseline.json` | Built |
| 3 | Prediction distribution | Live Low/Medium/High/Extreme share vs. the training label distribution (95 / 3 / 1.5 / 0.5) | `prediction_results` | Built (surfaced; no own alert threshold yet) |
| 4 | Missing-data rate | Null rate in `weather_data`/`river_data`, city coverage, per monitoring window | pipeline tables | Built |
| 5 | Model drift | PSI (Population Stability Index) between live feature distribution and the baseline | computed from #2 | Built |
| 6 | Model performance | Offline train/test metrics only — see the caveat below | `metrics.json`, `walkforward_results.csv` | Built (honestly limited) |
| 7 | Training history | Every registered run, not just the last | `ml_training_runs` + MLflow | Built |
| 8 | Rollback | Promote a previous (`Archived`) version | `ml_model_versions` | Built |
| 9 | Retraining triggers | A **flag for a human**, never an automatic retrain | drift/quality job → `ml_retraining_events` | Built (visible on the dashboard; not pushed) |

`POST /ml/train` and the old "Retrain Models" button were removed on
purpose — requirement 9 must produce a signal a human acts on.

---

## Feature drift — PSI

`feature_baseline.json` (written by `train_models.py` from the exact
training rows) stores each feature's quintile edges, so each baseline bin
holds 20% by construction. `mlops_service._psi()` buckets the last
`MONITORING_WINDOW_DAYS` (7) of live `ml_features` values into those same
edges and computes PSI.

Only `Rainfall_3Day`, `Avg_Temperature`, `Avg_WindSpeed` are monitored —
`Elevation`/`Coastal_Flag` are static per-city lookups (PSI ≈ 0 always),
`City_Encoded` is categorical.

Thresholds (`backend/config.py`, env-overridable):

| PSI | Status |
|---|---|
| ≤ 0.10 | NORMAL |
| 0.10 – 0.25 | WARNING → writes a `drift_alert` |
| > 0.25 | CRITICAL → writes a `drift_alert` |

These are the standard literature bands; all configurable so they can be
recalibrated once enough live data volume exists.

## Data quality

`compute_data_quality_metrics()` computes per-source missing rates
(rainfall/temperature/windspeed/river-level), `city_coverage_pct`, and a
composite `data_reliability_score = max(0, 100 − avg_missing) ×
coverage_factor`. Missing-data thresholds: > 5% = WARNING, > 10% =
CRITICAL → writes a `quality_alert`.

This is the simpler, aggregate score that predates the per-source
[Data Reliability layer](DATA_RELIABILITY_LAYER.md); the two are separate
and both are surfaced.

## Retraining triggers

A breach never calls `ML/train_models.py`. It writes a row to
`ml_retraining_events` (`drift_alert` / `quality_alert`), surfaced by
`GET /mlops/retraining-status` and the MLOps page. `retraining_recommended`
is `true` while the most recent event is still an unresolved alert (i.e.
not yet followed by a `promotion`). The recipient makes the same
deliberate offline `python ML/train_models.py` decision the policy always
required — now evidence-based.

## Model-performance monitoring — the honest caveat

Live performance monitoring normally compares predictions against ground
truth. **No historical or live flood-incident ground truth exists in this
project** — `Flood_Risk` is a derived Hazard × Vulnerability index. So:

- `GET /mlops/performance` returns the offline train/test metrics from
  the run that produced the model, explicitly tagged
  `ground_truth_available: false`. It never fabricates a live accuracy.
- What *can* be watched live: prediction-distribution shift (#3) and
  feature drift (#5) as **leading indicators** that the model may be
  extrapolating outside its training distribution — not proof of degraded
  accuracy.
- The real fix is Phase 2 of
  [ML_METHODOLOGY_AND_LIMITATIONS.md](ML_METHODOLOGY_AND_LIMITATIONS.md)
  (DMC river-gauge history accruing enough depth to serve as a real
  validation signal). Once that exists, `Predicted_Risk` can be compared
  against `river_data.Status` for the same date/station.

---

## Promotion & rollback — `promote_model_version()`

`POST /mlops/models/{version_id}/promote` is the **only** endpoint that
changes what the live app serves, and it is always a human action.

One function handles both cases:

- **Fresh promotion** — a `Candidate` from a recent `register_run.py`.
- **Rollback** — promoting an older `Archived` version *is* a rollback;
  there is no separate code path.

It: validates the target exists and its artifact file is present →
archives whatever row is currently `Production` → sets the target to
`Production` with `promoted_at = NOW()` → **copies the target artifact
over `ML/models/best_model.pkl`** → writes a `promotion` event to
`ml_retraining_events` → best-effort mirrors the stage into the MLflow
Model Registry.

Because the live artifact is a plain file copy, `backend/predict_flood.py`
keeps reading `ML/models/best_model.pkl` unchanged and the rollback takes
effect on the next prediction. `ml_service` also checks the registry
directly and prefers the `Production` row's `artifact_path` if present.
Encoders are shared per training run (not per version), so the latest
run's encoders are always used.

---

## What is NOT implemented

| Item | Note |
|---|---|
| `GET /metrics` (`prometheus_client`) | No Prometheus exposition endpoint |
| Prometheus / Grafana / Alertmanager | Drift & quality breaches are visible on the MLOps page, **not pushed** (no email/Slack/GitHub-issue notification) |
| `docker-compose.yml` | No container stack (backend + Postgres + MLflow + Prometheus + Grafana) |
| `.github/workflows/` | No CI / scheduled drift-check job |
| Prediction-distribution alert threshold | #3 is surfaced for a human to read but does not raise its own `ml_retraining_events` row |
| Automatic retraining | Deliberate — see the frozen-model policy |

These, plus the Docker/CI-CD line in the root README's "Future
Improvements", are the open implementation checklist if that scope is
greenlit.
