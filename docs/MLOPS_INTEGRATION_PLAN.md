# MLOps Integration Plan

This document designs how MLOps monitoring extends the existing DevOps
setup for this system. It does not change any code - it maps each
required monitoring capability onto this project's actual architecture
(the frozen-model policy in `docs/ML_METHODOLOGY_AND_LIMITATIONS.md`
§18, the `ML/` training pipeline, and the `backend/routes/ml.py` /
`MLDashboard` live API) and specifies concrete tools, data sources, and
new components. It is written to be lifted directly into the
dissertation's system-design chapter.

---

## 1. Why MLOps, distinct from DevOps

DevOps (already covered elsewhere in this project's documentation: the
scheduler in `backend/scheduler.py`, the planned CI/CD and Docker items
in `README.md`'s "Future Improvements") manages the *application* -
whether the FastAPI service is running, deployable, and tested.

MLOps manages the *model and the data flowing through it*, which DevOps
has no visibility into:

- Application code can be correct and the service can be "up" while the
  model silently degrades because the live weather/river feature
  distribution has drifted away from the 2010-2023 training distribution
  it was fit on.
- A code deploy is a `git diff`; a model deploy is a statistical claim
  ("this model still generalizes to today's data") that needs its own
  evidence trail, version history, and rollback path, independent of the
  application code's own versioning.
- This project already treats this distinction seriously in practice -
  the frozen-model policy (§18 of the methodology doc) exists precisely
  because *model* changes are deliberately decoupled from *application*
  deploys. MLOps monitoring is the missing other half of that policy: it
  gives the human who decides whether to re-run `ML/train_models.py`
  the evidence to decide, instead of that decision being made on a timer
  or a hunch.

---

## 2. Requirement -> mechanism -> tool mapping

| # | Requirement | What it concretely means here | Data source | Tool |
|---|---|---|---|---|
| 1 | Production model version | Which of RandomForest/XGBoost/LightGBM is frozen, and which training run produced it | `ML/reports/production_model.json` | MLflow Model Registry (stage: `Production`) |
| 2 | Feature distributions | Live `Rainfall_3Day`/`Avg_Temperature`/`Avg_WindSpeed` per city vs. the training-period distribution they were fit against | `ml_features` table | Prometheus histograms + Grafana |
| 3 | Prediction distribution | Live share of Low/Medium/High/Extreme predictions vs. the training label distribution (§4 of the methodology doc: 95/3/1.5/0.5) | `prediction_results.Predicted_Risk` | Prometheus counters + Grafana |
| 4 | Missing-data rate | Null/absent rate in `weather_data`, `river_data`, `ml_features` per collection cycle | pipeline step outputs (`backend/services/pipeline_service.py`) | Prometheus gauges |
| 5 | Model drift | Statistical distance (PSI or KS-test) between live feature distribution and the frozen training baseline | computed from #2 against a stored baseline | custom job, alerts via Prometheus/Grafana |
| 6 | Model performance | See §5 below - fundamentally limited, must be reported honestly | offline only: `ML/reports/metrics.json`, `walkforward_results.csv` | MLflow (offline runs only) |
| 7 | Training history | Every `ML/train_models.py` run, not just the last one | new: MLflow tracking logs params/metrics/artifacts per run | MLflow Tracking Server |
| 8 | Rollback | Revert `best_model.pkl` to a previous frozen version | versioned artifacts in MLflow Model Registry | MLflow Model Registry (`Production` <-> `Archived` transitions) |
| 9 | Retraining triggers | A flag, not an action - alerts a human when drift/missing-data crosses a threshold | drift job (#5) | Prometheus Alertmanager -> notification (email/Slack/GitHub issue) |

This project's frozen-model policy means requirement 9 must produce **a
signal a human acts on**, never an automatic retrain - consistent with
`POST /ml/train` having been deliberately removed (§18). The design
below never wires a retraining trigger to an automatic execution path.

---

## 3. Component architecture

```
                    ┌─────────────────────────────────────┐
   OFFLINE           │  ML/train_models.py (human-run)      │
   (training,         │    -> mlflow.log_params/metrics      │
   unchanged          │    -> mlflow.sklearn.log_model        │
   trigger: human)     │    -> Model Registry: stage=Staging   │
                    └─────────────┬─────────────────────────┘
                                  │ human reviews metrics,
                                  │ promotes Staging -> Production
                                  ▼
                    ┌─────────────────────────────────────┐
                    │  MLflow Model Registry                │
                    │  (replaces manual production_model.   │
                    │   json edits; still exports the same   │
                    │   manifest shape for backend compat)   │
                    └─────────────┬─────────────────────────┘
                                  │ backend reads current
                                  │ Production-stage model
                                  ▼
   LIVE               ┌─────────────────────────────────────┐
   (FastAPI app,       │  backend/services/ml_service.py       │
   unchanged           │    predict_with_best_model()          │
   inference path)     └─────────────┬─────────────────────────┘
                                  │ every prediction + every
                                  │ pipeline run emits metrics
                                  ▼
                    ┌─────────────────────────────────────┐
                    │  backend/services/monitoring_service.py│
                    │  (new) - computes:                     │
                    │    - feature summary stats per city     │
                    │    - PSI vs. training baseline           │
                    │    - prediction class distribution        │
                    │    - missing-data rate per pipeline run    │
                    └─────────────┬─────────────────────────┘
                                  │ exposed as
                                  ▼
                    GET /metrics  (prometheus_client)
                                  │ scraped every N minutes
                                  ▼
                    ┌─────────────────────────────────────┐
                    │  Prometheus  ->  Grafana dashboards    │
                    │  Alertmanager -> notification on         │
                    │  drift/missing-data threshold breach       │
                    │  ("retraining trigger" = alert, NOT an     │
                    │  automatic call to train_models.py)         │
                    └─────────────────────────────────────┘
```

GitHub Actions' role is narrower than the other three tools: it runs
tests/lint on every push (standard CI, not MLOps-specific), and
optionally runs the drift job on a schedule as a backstop for when
Prometheus isn't deployed (e.g., a scheduled Action that queries
`/metrics` or re-runs the PSI check and opens a GitHub issue if the
threshold is breached).

---

## 4. New components this would add (when implementation is scoped)

| Component | Type | Purpose |
|---|---|---|
| `ML/train_models.py` | modified | add `mlflow.start_run()` around each candidate model's fit/eval, `mlflow.log_metrics(...)` for the §11 table's columns, `mlflow.sklearn.log_model(...)`, register to Model Registry with stage `Staging` |
| `ML/baseline_stats.py` | new | computes and saves per-feature mean/std/percentile buckets on the training set, for the PSI calculation to compare live data against |
| `ML/reports/feature_baseline.json` | new artifact | output of the above; frozen alongside `production_model.json` at training time |
| `backend/services/monitoring_service.py` | new | reads `ml_features`/`prediction_results`/pipeline run logs; computes PSI, missing-data rate, prediction distribution |
| `backend/routes/monitoring.py` | new | `GET /monitoring/drift`, `GET /monitoring/data-quality`, `GET /monitoring/predictions` - feeds both the dashboard and `/metrics` |
| `GET /metrics` | new (in `backend/app.py`) | `prometheus_client` exposition endpoint, scraped by Prometheus |
| `flood-frontend/src/pages/MLDashboard` | extended | new panel: drift score per feature, missing-data rate trend, prediction-distribution chart, model version/rollback history - alongside the existing Model Comparison / Best Model panels |
| `docker-compose.yml` | new | `backend`, `postgres`, `mlflow` (tracking server + registry backed by Postgres/S3-compatible artifact store), `prometheus`, `grafana` |
| `.github/workflows/ci.yml` | new | test/lint on push; optional scheduled drift-check job |

None of these exist yet - this section is the implementation checklist
for whenever the "in-app monitoring" or "full stack" scope is greenlit.

---

## 5. Model performance monitoring - the one requirement that needs a caveat

Live model-performance monitoring normally compares predictions against
ground truth as it arrives. This project's own documented limitation
(§17.1 of the methodology doc) is that **no historical or live
flood-incident ground truth exists** - `Flood_Risk` is a derived hazard
x vulnerability index, not an observed event. That means:

- There is no live accuracy/F1/recall to monitor the way #6 in the
  table above implies, today.
- What *can* be monitored live, honestly: prediction-distribution shift
  (#3) and feature drift (#5) as **leading indicators** that the model
  may be extrapolating outside its training distribution - not proof of
  degraded accuracy, since accuracy can't be measured without labels.
- The real fix is §16's Phase 2 (DMC river-gauge history accruing
  enough depth to serve as a genuine validation signal). Once that
  exists, live performance monitoring against real observed
  flood/river-alert status becomes possible and should be added as a
  direct extension of `monitoring_service.py` - comparing
  `prediction_results.Predicted_Risk` against `river_data`'s DMC
  `Status` field for the same date/station.

This is stated explicitly rather than glossed over, matching this
project's existing practice of reporting limitations rather than
adjusting the framing to hide them (see §12, §17 of the methodology
doc).

---

## 6. Rollback design

Today, "rollback" means manually restoring an old `best_model.pkl` from
git history or a backup - not tracked, not documented, no manifest for
it. With MLflow Model Registry:

1. Every training run registers a new model version (v1, v2, v3, ...)
   under a registered model name (e.g. `flood-risk-classifier`),
   regardless of which of the three algorithms won that run.
2. Promoting a version to stage `Production` is the same deliberate,
   human-reviewed action the frozen-model policy already requires
   before a `train_models.py` run's output goes live - MLflow just gives
   it a version number and full audit trail (who/when/what metrics)
   instead of an implicit git commit.
3. Rollback = transitioning the previous version back to `Production`
   (`MlflowClient.transition_model_version_stage(...)`) - an operation
   with its own log entry, reversible in one call, no retraining
   required.
4. `backend/services/ml_service.py`'s model-loading call changes from
   reading `ML/models/best_model.pkl` directly to
   `mlflow.sklearn.load_model("models:/flood-risk-classifier/Production")`
   - the live app always loads whatever is currently staged
   `Production`, so a rollback takes effect on the next prediction
   without a code deploy.

---

## 7. Retraining trigger design

Trigger conditions (initial, tunable thresholds - would need calibration
once live data volume is sufficient):

- **Feature drift**: PSI > 0.2 for any of `Rainfall_3Day`,
  `Avg_Temperature`, `Avg_WindSpeed` (0.2 is the commonly cited
  "moderate drift, investigate" PSI threshold in the MLOps literature).
- **Missing-data rate**: > 10% of expected daily rows missing across any
  pipeline stage over a rolling 7-day window.
- **Prediction distribution shift**: live High+Extreme share deviates
  from the training-period 2.01% (§4's table) by more than a
  to-be-calibrated margin, sustained over multiple pipeline runs (not a
  single spike, which is expected - flood risk is seasonal).

Action on trigger: Alertmanager notification (email/Slack/GitHub issue)
naming which condition fired and its current value. **No automatic
retraining call.** The notification's recipient makes the same
deliberate, offline `python ML/train_models.py` decision the policy
already requires - this only makes the decision evidence-based and
timely instead of ad hoc.

---

## 8. Phased rollout (for planning/timeboxing against the dissertation deadline)

| Phase | Scope | Effort | Dissertation value |
|---|---|---|---|
| 1 | MLflow tracking in `ML/train_models.py` + `monitoring_service.py` computing drift/missing-data/prediction-distribution, surfaced via new REST endpoints and an MLDashboard panel | Low-medium; no new infra, runs inside the existing FastAPI app and repo | Directly demoable, screenshots for the write-up, closes 7 of 9 requirements (all but live performance monitoring and full alerting) |
| 2 | `GET /metrics` (prometheus_client) + Prometheus + Grafana dashboards + Alertmanager | Medium; new services to run locally or in a compose stack | Matches the tools named in your requirement (Prometheus/Grafana explicitly), gives dashboard screenshots suited to a systems chapter |
| 3 | `docker-compose.yml` (backend + Postgres + MLflow + Prometheus + Grafana) + GitHub Actions CI/scheduled drift check | Medium-high; real infra setup and debugging time | Completes the DevOps items already listed in `README.md`'s "Future Improvements" (Docker Deployment, CI/CD Pipeline) at the same time |

Phase 1 alone answers every monitoring requirement except live model
performance (§5's caveat, which is a data-availability limitation no
tool can fix) and closes the loop from "detect drift" to "a human is
notified" only partially (no Alertmanager yet - Phase 1's drift/data-
quality numbers would be visible on the dashboard on request, not
pushed as an alert). Phase 2 adds the push-alerting and the specific
tools named in the requirement.

---

## 9. Where this fits in the existing documentation

- `docs/ML_METHODOLOGY_AND_LIMITATIONS.md` §18 ("Production deployment:
  frozen model policy") should gain a forward reference to this
  document once any phase is implemented, since MLOps monitoring is the
  evidence layer that policy currently lacks.
- `README.md`'s "Future Improvements" list (Docker Deployment, CI/CD
  Pipeline) should be updated to reference Phase 3 here rather than
  standing alone, since this plan supersedes them with a fuller scope
  (MLflow, Prometheus/Grafana) than what was originally listed.
