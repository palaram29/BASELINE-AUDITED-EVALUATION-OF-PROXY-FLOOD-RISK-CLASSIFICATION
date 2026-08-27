# ML Pipeline (`ML/` module)

The `ML/` package is the **offline** model pipeline: it builds the
training dataset, trains and compares three algorithms, selects and
freezes a winner, and produces the reports the API and dashboard read.
It is run by a human — nothing in the live backend imports or triggers
training. For *why* the task is framed the way it is and what the
results mean, see
[ML_METHODOLOGY_AND_LIMITATIONS.md](ML_METHODOLOGY_AND_LIMITATIONS.md).

`ML/` has no database dependency. The one exception is `register_run.py`,
a separate human-run step that writes a completed run into the MLOps
registry (see [MLOPS.md](MLOPS.md)).

---

## Files

| File | Role |
|---|---|
| `utils.py` | Single source of truth: feature/target column names, `ELEVATION_MAP` & `COASTAL_MAP`, all artifact/report paths (incl. legacy fallbacks), the `logs/ml_pipeline.log` logger, `prepare_data()`, `resolve_model_paths()`, `compute_feature_distribution()` |
| `prepare_dataset.py` | Raw historical CSVs → `train_dataset.csv` / `test_dataset.csv` (t+1 pairs, derived Hazard×Vulnerability label, global percentile thresholds) |
| `export_label_params.py` | `processed_dataset.csv` → `ML/reports/label_construction.json` — freezes the rainfall min/max, RiskScore thresholds and per-city `Vulnerability` so the backend's same-day ("Today") risk index (`live_risk_service.py`) matches the training labels. No model involved. Re-run only when `prepare_dataset.py` changes. |
| `model_selector.py` | `MODEL_REGISTRY` (RF/XGBoost/LightGBM factories + hyperparameters), `select_best_model()` |
| `evaluate_models.py` | `evaluate_model()` (fit/predict timing + full metric set), `save_confusion_matrix()` (PNG + CSV), `build_comparison_table()` |
| `train_models.py` | CLI orchestrator: load → train all → evaluate → compare → select → save winner + reports + frozen manifest; logs to MLflow best-effort |
| `walkforward_validate.py` | Mandatory secondary check: 6-fold rolling-origin validation, refitting the whole pipeline per fold; includes the baselines |
| `baselines.py` | Majority / Persistence / Seasonal baselines (used by walk-forward only) |
| `predict.py` | `load_best_model()`, `load_model_from_paths()`, `predict_risk()`, `predict_one()` — reusable inference, imported by `backend/predict_flood.py` and `backend/services/ml_service.py` |
| `register_run.py` | Register the last training run into Postgres as MLOps history (all versions `Candidate`) |
| `run_reliability_experiments.py` | Degraded-data robustness experiment — see [DATA_RELIABILITY_LAYER.md](DATA_RELIABILITY_LAYER.md) |

---

## Dataset preparation — `prepare_dataset.py`

Input: `ML/data/raw_historical_{train,test}.csv` (2010–2023 daily
`City, Rainfall_3Day, Avg_Temperature, Avg_WindSpeed, Elevation`, plus
`Start_Date`/`End_Date`). These CSVs are git-ignored (large, sourced
outside the repo).

Processing order (leakage-safe):

1. Load + parse dates, combine into one chronological pool.
2. Attach `Coastal_Flag` from `COASTAL_MAP`; attach reliability features
   (`attach_reliability_features` — genuine completeness/validity/history,
   neutral timeliness since no ingestion timestamp survives historically).
3. Chronological split: `End_Date` year ≤ 2019 → train, ≥ 2020 → test.
4. Fit rainfall min/max on the **training period only**;
   `Hazard = clip(normalized Rainfall_3Day, 0, 1)`.
5. `Vulnerability = 0.5·InverseElevation + 0.5·Coastal_Flag`, elevation
   normalized against the 30-city map and clipped to `[0.05, 0.95]`.
6. `RiskScore = Hazard × Vulnerability`.
7. Fit **global** percentile thresholds (Extreme ≥ 99.5%, High ≥ 98%,
   Medium ≥ 95%) on training-period `RiskScore`; apply unchanged to every
   row.
8. Build `t → t+1` pairs per city (features at `t`, label from `t+1`);
   drop each city's last row and the one boundary-straddling pair.

Output: `train_dataset.csv` (~109k rows), `test_dataset.csv` (~38k rows),
`processed_dataset.csv` (pre-pairing), plus a printed class-distribution
summary.

`ML/export_label_params.py` then reads `processed_dataset.csv` and freezes
the same-day label parameters (rainfall min/max, RiskScore percentile
thresholds, per-city `Vulnerability`) to `ML/reports/label_construction.json`
— consumed by the backend's rule-based "Today" risk index, not by any
model. See [ML_METHODOLOGY_AND_LIMITATIONS.md](ML_METHODOLOGY_AND_LIMITATIONS.md)
§19 and [DATA_PIPELINE.md](DATA_PIPELINE.md) step 7.

---

## Training & comparison — `train_models.py`

```bash
python ML/train_models.py                                   # uses ML/data/{train,test}_dataset.csv
python ML/train_models.py --train-file T.csv --test-file V.csv
python ML/train_models.py --metric roc_auc                  # override selection metric
python ML/train_models.py --feature-set reliability_aware   # research config, parallel paths
```

For each algorithm in `MODEL_REGISTRY` (Random Forest, XGBoost, LightGBM):

- **Class imbalance:** RF and LightGBM use `class_weight="balanced"`;
  XGBoost gets a balanced `sample_weight` computed from `y_train` only.
- Fit on the identical split, time training and prediction, compute
  Accuracy, weighted & macro Precision/Recall/F1, per-class recall
  (`High`, `Extreme`), ROC-AUC (OVR weighted, skipped gracefully if
  unavailable), classification report, confusion matrix, feature
  importance.
- Save each model to `ML/models/<algo>.pkl`; write a confusion-matrix
  PNG + CSV.
- Log params/metrics/model to MLflow (`sqlite:///mlflow.db` by default) —
  wrapped so any MLflow failure never breaks training.

Then `select_best_model()` picks the winner and the script writes:

| Artifact | Contents |
|---|---|
| `ML/models/best_model.pkl` | The selected model — **loaded by the prediction API** |
| `ML/models/city_encoder.pkl`, `flood_label_encoder.pkl` | The run's encoders |
| `ML/reports/model_comparison.csv` | One row per model, all metrics, `Selected` column |
| `ML/reports/metrics.json` | Same data, machine-readable, + classification report + feature importance |
| `ML/reports/production_model.json` | Frozen manifest: model name, version, `status:"frozen"`, feature list, dataset date ranges, the metrics that justified selection, retraining policy |
| `ML/reports/feature_baseline.json` | Per-feature training distribution (mean/std/quintile edges) — the input to live PSI drift monitoring |
| `ML/reports/confusion_matrices/*.png`/`.csv` | Per model |

`--feature-set reliability_aware` writes to
`ML/models/reliability_aware/` and `ML/reports/reliability_aware/` so it
never touches the baseline (production) artifacts.

### Selection rule — `model_selector.py::select_best_model`

Default metric is **macro-F1**. Models within `0.02` macro-F1 of the
leader are treated as tied; among those, a model beating the leader's
**High-risk recall** by ≥ `0.05` wins (falling back to Extreme-risk
recall). Passing `--metric X` bypasses the hierarchy and simply
maximises `X` (with f1_score/accuracy as deterministic tie-breakers).

Adding a new algorithm (CatBoost, an RNN, …) is one entry in
`MODEL_REGISTRY` + `MODEL_FILENAMES` — no other file changes.

---

## Walk-forward validation — `walkforward_validate.py`

```bash
python ML/walkforward_validate.py
```

Six rolling-origin folds (`Train 2010–2016 → Test 2017`, …,
`Train 2010–2021 → Test 2022`), each refitting rainfall normalization
and the global percentile thresholds on that fold's own training period.
Runs all three algorithms **and** the three baselines per fold. Writes
`ML/reports/walkforward_results.csv`. This is the mandatory robustness
check behind the results in
[ML_METHODOLOGY_AND_LIMITATIONS.md](ML_METHODOLOGY_AND_LIMITATIONS.md).

---

## How the live system picks up a new model

1. `backend/config.py` calls `ML.utils.resolve_model_paths()` at import:
   `ML/models/best_model.pkl` if present, else `ML_Training/*.pkl`
   (legacy fallback — keeps a fresh checkout working before the pipeline
   has ever run).
2. `backend/predict_flood.py` and `backend/services/ml_service.py` load
   through `ML.predict`, so every prediction run uses whatever
   `train_models.py` last selected — **no backend code change after
   retraining**.
3. `ml_service` additionally prefers a version marked `Production` in the
   `ml_model_versions` registry over the plain file, if one has been
   promoted (see [MLOPS.md](MLOPS.md)).

## Full offline retraining sequence

```bash
python ML/prepare_dataset.py            # rebuild datasets (only if raw data changed)
python ML/export_label_params.py        # refreeze label_construction.json (only if prepare_dataset changed)
python ML/train_models.py               # train, compare, freeze the winner
python ML/walkforward_validate.py       # robustness check
python ML/register_run.py               # register candidates into the MLOps registry
# then review metrics on the console's MLOps page and POST /mlops/models/{id}/promote
```

The legacy `ML_Training/ML_Training.py` trains a single Random Forest to
the `ML_Training/*.pkl` paths and is kept only as the fallback target.
