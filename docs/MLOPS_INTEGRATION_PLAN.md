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

## 0. Implementation status (update - this plan is now partly built)

Sections 1-9 below are kept as originally written, since the reasoning
still holds and is meant to be lifted into the dissertation. This section
records what has actually been implemented since, so the rest of the
document can be read as "design intent," not "current state."

**Built and live today:**

- `ML/train_models.py` logs every run to MLflow (`mlflow.start_run`,
  `log_params`/`log_metrics`, `mlflow.sklearn.log_model`) against
  `sqlite:///mlflow.db` - requirement 7 (training history) and half of
  requirement 1 (model version) from §2's table.
- Feature drift (PSI vs. a stored training baseline), live prediction-
  class distribution vs. the training-period reference, and per-source
  missing-data rate are all computed for real (not stubbed) by
  `backend/services/mlops_service.py` and exposed via `GET /mlops/drift`,
  `GET /mlops/predictions`, and `GET /mlops/data-quality` - requirements
  2, 3, 4 and 5.
- Rollback (requirement 8) works, but the design in §6 changed: **Postgres
  is the source of truth, not the MLflow Model Registry.** Every training
  run's candidate versions are written to a new `ml_model_versions` table
  (`database/db_connection.py::ensure_mlops_tables`); `POST
  /mlops/models/{id}/promote` flips one row's `status` to `Production`
  (archiving whichever was previously `Production`) and copies that
  artifact over `ML/models/best_model.pkl` - the same function handles a
  fresh promotion and a rollback, since promoting an older `Archived`
  version *is* a rollback. The MLflow Model Registry stage is still
  updated too (`_mlflow_transition_stage_best_effort`), but only as a
  best-effort audit mirror - if MLflow is unreachable, promotion still
  succeeds, which the original §6 design (MLflow Registry as the
  authority the live app reads from) didn't allow for.
- Retraining triggers (requirement 9) are implemented as designed: drift/
  quality threshold breaches write a row to `ml_retraining_events`
  (`event_type='drift_alert'`/`'quality_alert'`), surfaced via `GET
  /mlops/retraining-status`. There is still no automatic call to
  `ML/train_models.py` anywhere - matches §2's "signal a human acts on,
  never an automatic retrain" rule exactly.
- `flood-frontend/src/pages/MLDashboard` and the newer `MLOps` page
  render all of the above (model version/registry, training history,
  drift, data quality, prediction distribution, retraining status,
  health rollup, promote/rollback action).
- Model-performance monitoring (requirement 6) is implemented exactly as
  §5 below says it honestly can be: `GET /mlops/performance` returns the
  offline train/test metrics tagged `ground_truth_available: false`,
  never a fabricated live accuracy.

**Still not implemented (§8's Phase 2 push-alerting and Phase 3):**

- No `GET /metrics` / `prometheus_client` exposition endpoint.
- No Prometheus, Grafana, or Alertmanager - drift/quality breaches are
  visible on `/mlops/retraining-status` and the MLOps page on request,
  not pushed to a human (no email/Slack/GitHub-issue notification yet).
- No `docker-compose.yml` and no `.github/workflows/` CI - the Phase 3
  items, and the Docker/CI-CD line in `README.md`'s "Future
  Improvements", are unchanged from the original plan.

In short: **Phase 1 shipped in full, plus the registry/rollback half of
Phase 2** - implemented against Postgres instead of the MLflow Model
Registry as the system of record, with MLflow kept as a best-effort
audit trail rather than a hard dependency of the live request path.
Phase 2's push-alerting half and all of Phase 3 remain exactly as
designed below.

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

| Component | Type | Purpose | Status |
|---|---|---|---|
| `ML/train_models.py` | modified | add `mlflow.start_run()` around each candidate model's fit/eval, `mlflow.log_metrics(...)`, `mlflow.sklearn.log_model(...)` | **Done** |
| `ML/register_run.py` | new (not in the original plan) | registers a completed training run's candidate versions into the `ml_model_versions` Postgres table, ready to be promoted | **Done** |
| `ML/baseline_stats.py` (shipped as part of `ML/prepare_dataset.py`'s output) | new | per-feature quantile buckets on the training set for the PSI calculation | **Done**, as `ML/reports/feature_baseline.json` |
| `backend/services/monitoring_service.py` | new | reads `ml_features`/`prediction_results`; computes PSI, missing-data rate, prediction distribution | **Done**, shipped as `backend/services/mlops_service.py` (broader scope - also owns the model registry/promotion) |
| `backend/routes/monitoring.py` | new | drift/data-quality/prediction endpoints | **Done**, shipped as `backend/routes/mlops.py` (`GET /mlops/drift`, `/mlops/data-quality`, `/mlops/predictions`, plus registry/promote endpoints not in the original scope) |
| `GET /metrics` | new (in `backend/app.py`) | `prometheus_client` exposition endpoint, scraped by Prometheus | Not built |
| `flood-frontend/src/pages/MLDashboard` | extended | drift/missing-data/prediction-distribution panels, model version/rollback history | **Done**, plus a dedicated `MLOps` page beyond the original one-page scope |
| `docker-compose.yml` | new | `backend`, `postgres`, `mlflow`, `prometheus`, `grafana` | Not built |
| `.github/workflows/ci.yml` | new | test/lint on push; optional scheduled drift-check job | Not built |

Everything marked **Done** above shipped without the MLflow Model
Registry acting as the system of record - see §0 for why Postgres took
that role instead. The remaining rows (Prometheus/Grafana/Alertmanager
and the Docker/CI stack) are still an open implementation checklist for
whenever that scope is greenlit.

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

**As designed below** (kept for the dissertation's design-rationale
narrative). **As actually built** (see §0): the same outcome was
implemented against Postgres instead of the MLflow Model Registry -
`ml_model_versions.status` (`Candidate`/`Production`/`Archived`) is the
source of truth, `POST /mlops/models/{id}/promote`
(`backend/services/mlops_service.py::promote_model_version`) is the one
function that both promotes a fresh candidate and performs a rollback
(promoting an `Archived` version), and it copies the target artifact
over `ML/models/best_model.pkl` directly rather than the live app
resolving `models:/flood-risk-classifier/Production` from MLflow at
inference time - step 4 below did not end up happening this way, so
`backend/predict_flood.py` keeps reading the plain `.pkl` file
unchanged, and a rollback takes effect via that file copy instead of a
registry-stage read.

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

**As built:** the trigger conditions and "alert, not automation" rule
below are implemented, writing to `ml_retraining_events`
(`event_type='drift_alert'`/`'quality_alert'`) - the delivery mechanism
differs (no Alertmanager yet, so the event is visible on `GET
/mlops/retraining-status` and the MLOps page on request, not pushed to a
human via email/Slack/GitHub issue), and the shipped thresholds
(`backend/config.py`, overridable via env vars) are stricter than
originally proposed here:

- **Feature drift**: PSI **> 0.1** = WARNING, **> 0.25** = CRITICAL
  (`DRIFT_PSI_WARNING_THRESHOLD` / `DRIFT_PSI_CRITICAL_THRESHOLD`) for
  each of `Rainfall_3Day`, `Avg_Temperature`, `Avg_WindSpeed` - not the
  single 0.2 cutoff first proposed here.
- **Missing-data rate**: **> 5%** = WARNING, **> 10%** = CRITICAL
  (`MISSING_DATA_WARNING_PCT` / `MISSING_DATA_CRITICAL_PCT`) over the
  monitoring window, computed per source.
- **Prediction distribution shift**: live High+Extreme share vs. the
  training-period reference (§4's table) is surfaced via `GET
  /mlops/predictions` for a human to read, but does not yet feed its own
  WARNING/CRITICAL threshold or `ml_retraining_events` row - only drift
  and missing-data currently raise alerts.

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
  frozen model policy") now references this document and §0 above,
  since Phase 1 is implemented and is no longer a gap that policy lacks.
- `README.md`'s "Future Improvements" list now names Phase 2's
  push-alerting and the Phase 3 Docker/CI-CD stack specifically, rather
  than the original generic "Docker Deployment, CI/CD Pipeline" bullets,
  since Phase 1 (and part of Phase 2) is no longer future work.
