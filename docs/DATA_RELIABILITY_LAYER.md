# Data Source Reliability Layer

This document covers the reliability-scoring layer that sits between raw
data collection and the ML pipeline, and the research experiment that
tests whether feeding reliability scores into the model as features
improves robustness under degraded data. It builds alongside — not
instead of — the base forecasting methodology
([ML_METHODOLOGY_AND_LIMITATIONS.md](ML_METHODOLOGY_AND_LIMITATIONS.md))
and the MLOps monitoring layer
([MLOPS.md](MLOPS.md)).

---

## 1. Why: raw sources are trusted uncritically today

Before this layer, `weather_data` and `river_data` rows fed straight into
`ML/generate_ml_features.py` with no notion of whether a given source (a
city's weather feed, a river gauge station) was complete, on time, passing
sanity checks, or had a track record of being trustworthy. A source that
went stale, started dropping fields, or briefly reported a corrupted
reading was indistinguishable from a healthy one. The reliability layer
scores every source on each of these axes so the pipeline, the dashboard,
and (experimentally) the model itself can tell the difference.

## 2. The four components and the combined score

```
reliability_score = 0.25 x Completeness
                   + 0.25 x Timeliness
                   + 0.25 x Validity
                   + 0.25 x Historical Reliability
```

- **Completeness** (`reliability/completeness.py`) - expected-vs-received
  record counts over a rolling window. The expected cadence is *derived*
  from that source's own historical timestamp gaps (median inter-arrival
  time), not a hard-coded interval, so a source with a naturally sparser
  reporting rhythm isn't penalized for it.
- **Timeliness** (`reliability/timeliness.py`) - 1.0 if a record arrives
  within an acceptable delay, linearly falling to 0.0 by a configured max
  delay.
- **Validity** (`reliability/validity.py`) - per-variable range/sanity
  checks (rainfall, temperature, wind speed, river level) plus batch-level
  checks (nulls, duplicates, invalid timestamps, outliers by z-score).
  Never drops a row - only flags it, so raw data is preserved for audit.
- **Historical Reliability** (`reliability/historical.py`) - an
  exponential moving average of a source's *own past* composite scores,
  seeded with a configured default when there's no history yet. Built only
  from prior observations, never the one currently being scored, so it
  can't be circular/leaky.

Weights are equal (0.25 each) and configurable via `RELIABILITY_WEIGHT_*`
env vars (`reliability/config.py`) - not a literature-fitted split, a
documented default, matching this project's existing practice for the
Hazard/Vulnerability weighting in `ML_METHODOLOGY_AND_LIMITATIONS.md` §3.

Classification: **HIGH** (score >= 0.80), **MEDIUM** (>= 0.60), **LOW**
(below 0.60) - `RELIABILITY_HIGH_THRESHOLD` / `RELIABILITY_MEDIUM_THRESHOLD`,
also configurable.

## 3. Architecture

- **`reliability/`** is a pure, DB-free scoring engine - no imports from
  `backend/` or `database/`. This is deliberate: it's shared unchanged by
  the live backend, the ML training pipeline, and the research experiment
  runner (§5), so all three score data the exact same way.
- **`backend/services/reliability_service.py`** / **`backend/routes/reliability.py`**
  computes and persists scores into the `data_reliability` /
  `data_validation_log` Postgres tables
  (`database/db_connection.py::ensure_data_reliability_tables`), exposed
  via `GET /reliability`, `/reliability/sources`, `/reliability/history`,
  `/reliability/summary`, `/reliability/validation-flags`. Flagged/invalid
  records are never deleted from `weather_data`/`river_data` - only logged
  for audit. Runs automatically after every scheduled pipeline cycle
  (`backend/scheduler.py`); low scores are logged as monitoring alerts
  (`ml_monitoring_metrics`, surfaced via `GET /mlops/health`).
- **`backend/generate_ml_features.py`** attaches `Weather_Reliability` /
  `River_Reliability` / `Overall_Data_Reliability` to every `ml_features`
  row, computed only from data available up to that row's own date (no
  look-ahead leakage into the t -> t+1 forecasting task).
  The same `Overall_Data_Reliability` is carried through onto both the
  t+1 prediction rows (`prediction_service`) and the same-day
  `live_risk` rows (`live_risk_service`) as
  `data_reliability_score` / `_level` / `degraded_data_warning` -
  additive fields, never gating the result.
- **Frontend**: a compact reliability widget on the Dashboard and inline
  on every prediction row and same-day risk-index row (visually and
  semantically separate from the model's own predicted-risk probability -
  a data-quality signal, never model confidence; the rule-based "Today"
  index has no probability at all), plus a full `/reliability` page
  (`flood-frontend/src/pages/Reliability`, `src/components/reliability/`)
  with per-source detail, a history chart, and the validation-flags audit
  table.
- This is distinct from `backend/services/mlops_service.py`'s older,
  simpler `data_reliability_score` (an aggregate missing-rate metric, used
  by the MLOps data-quality panel, unaffected by this layer) - this is the
  new per-source, four-component weighted score.

## 4. Baseline vs. reliability-aware feature configurations

`ML/train_models.py --feature-set {baseline|reliability_aware}` trains all
three algorithms (Random Forest, XGBoost, LightGBM) on two column sets:

| Feature set | Columns |
|---|---|
| `baseline` (production default) | `Rainfall_3Day, Avg_Temperature, Avg_WindSpeed, Elevation, Coastal_Flag` |
| `reliability_aware` | baseline + `Weather_Reliability, River_Reliability, Overall_Data_Reliability` |

The live prediction pipeline always serves the **baseline** model
(unchanged frozen-model policy, `ML_METHODOLOGY_AND_LIMITATIONS.md` §18) -
a reliability-aware model only becomes production via the existing manual
`POST /mlops/models/{id}/promote` workflow, and only once the evidence
below justifies it.

## 5. Degraded-data experiment methodology

```bash
python ML/run_reliability_experiments.py
```

Trains all 3 algorithms x 2 feature configurations once, on the same
(undegraded) 2010-2019 training split used throughout this project, then
evaluates each of the 6 resulting models against **6 controlled test-set
conditions** built by `reliability/degradation.py` - pure, in-memory
transforms that never touch `ML/data/*.csv`, `ML/models/`, or any database
table:

| Condition | Transform |
|---|---|
| `normal` | untouched test set (control) |
| `missing_10` / `missing_20` / `missing_30` | 10% / 20% / 30% of numeric values replaced with `NaN`, uniformly at random |
| `delayed` | 50% of rows get a simulated 240-minute arrival delay recorded (feeds the timeliness component) |
| `invalid` | 10% of numeric values replaced with corrupted out-of-range values (large negative or absurdly large), modelling sensor faults |

This tests the actual research hypothesis: does giving the model explicit
reliability scores as input features let it partially compensate when the
*other* features it depends on are missing, late, or corrupted - i.e. does
the model learn to trust a low-reliability reading less?

## 6. Results - reported as measured, not adjusted

Real, computed output of `ML/run_reliability_experiments.py`, written to
`ML/reports/reliability_experiments/comparison_table.csv`. Per this
project's existing rule (`ML_METHODOLOGY_AND_LIMITATIONS.md` §12: report
what the numbers show, not what would look best), here is the actual
macro-F1 for each condition, algorithm, and feature set:

| Condition | Random Forest (baseline -> rel-aware) | XGBoost (baseline -> rel-aware) | LightGBM (baseline -> rel-aware) |
|---|---:|---:|---:|
| normal | 0.5626 -> 0.5618 (-0.001) | 0.5308 -> 0.5059 (-0.025) | 0.5276 -> 0.4161 (-0.112) |
| missing_10 | 0.5540 -> 0.5563 (+0.002) | 0.5246 -> 0.5004 (-0.024) | 0.5266 -> 0.4137 (-0.113) |
| missing_20 | 0.5343 -> 0.5391 (+0.005) | 0.5083 -> 0.4765 (-0.032) | 0.5105 -> 0.4029 (-0.108) |
| missing_30 | 0.5136 -> 0.5163 (+0.003) | 0.4841 -> 0.4505 (-0.034) | 0.4898 -> 0.3904 (-0.099) |
| delayed | 0.5626 -> 0.5610 (-0.002) | 0.5308 -> 0.5058 (-0.025) | 0.5276 -> 0.4153 (-0.112) |
| invalid | 0.4272 -> 0.4354 (+0.008) | 0.3994 -> 0.3757 (-0.024) | 0.3953 -> 0.3184 (-0.077) |

**Honest interpretation:**

- **Random Forest** (the algorithm this project's model selector actually
  picks, `ML_METHODOLOGY_AND_LIMITATIONS.md` §14) is the only one of the
  three where reliability-aware features help, and only under degraded
  conditions - a small but consistent macro-F1 gain under `missing_10/20/30`
  and `invalid` (+0.002 to +0.008), with a negligible loss under `normal`
  and `delayed` (-0.001 to -0.002). This is a modest, not dramatic,
  robustness improvement.
- **XGBoost and LightGBM get consistently worse macro-F1 with
  reliability-aware features, in every single condition** - a small
  regression for XGBoost (-0.02 to -0.03) and a large one for LightGBM
  (-0.08 to -0.11). Several of these runs show higher High/Extreme-risk
  *recall* under reliability_aware (e.g. XGBoost's High recall goes from
  0.494 to 0.702 in the `normal` condition), suggesting the added features
  push these two algorithms toward over-predicting elevated risk at a
  precision cost large enough to hurt macro-F1 overall - a trade-off, not
  an unambiguous improvement.
- **Net finding**: reliability-aware features are not a universal win.
  They provide a small, real robustness benefit specifically for the
  production-selected Random Forest model under degraded-data conditions,
  which is evidence in favor of the research hypothesis for that one
  algorithm - but they measurably hurt XGBoost and especially LightGBM.
  This is reported as measured; no result here was cherry-picked or the
  methodology adjusted to reach a cleaner conclusion.

## 7. Limitations

1. The degradation conditions (§5) are synthetic, applied uniformly at
   random - real-world failure modes (e.g. an entire station going dark
   for days, or a specific field consistently miscalibrated) may behave
   differently than uniform random corruption/missingness.
2. Reliability-aware feature values themselves are computed from the same
   (undegraded) historical data the baseline model trains on - there is no
   simulated *training-time* degradation, only test-time. Training under
   degraded conditions is a natural extension not yet implemented.
3. As with every other component in this system, no ground-truth
   flood-incident record exists to validate reliability scores against
   real outcomes (`ML_METHODOLOGY_AND_LIMITATIONS.md` §17.1) - reliability
   scores are validated against their own definitions (completeness,
   timeliness, validity, historical consistency), not against whether a
   "reliable" reading actually preceded a more accurate prediction.
