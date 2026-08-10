# ML Model Comparison Module — Documentation

## 1. What this change does

Extends the existing machine learning module so the system can train and
compare **Random Forest**, **XGBoost**, and **LightGBM** on the same
dataset, preprocessing pipeline, and train/test split, evaluate them on a
common set of metrics, and automatically select and deploy the best one.

This was implemented as a **new, additive module** (`ML/`). Nothing in the
existing backend, database, or frontend was rebuilt — a small number of
existing backend files were edited to wire the new module in, in a way
that is fully backward compatible with the model that was already deployed.

---

## 2. New files added

All new files live under `ML/` at the project root.

| File | Responsibility |
|---|---|
| `ML/__init__.py` | Marks `ML/` as a Python package so it can be imported as `ML.utils`, `ML.predict`, etc. |
| `ML/utils.py` | Single source of truth shared by the rest of the module: feature/target column names, the city→elevation lookup, all artifact/report paths (including the legacy fallback paths), the `logs/ml_pipeline.log` logger, and `prepare_data()` — the train/test loading + encoding pipeline (unchanged logic, just centralized). |
| `ML/model_selector.py` | `MODEL_REGISTRY` — a dict of `{name: factory}` for the three algorithms. Also `select_best_model(results, metric)`, which picks the winner by a configurable metric (defaults to F1 Score). Adding a new algorithm (CatBoost, LSTM, GRU, …) later is a single new entry here — no other file needs to change. |
| `ML/evaluate_models.py` | `evaluate_model()` — fits a model, times training/prediction, and computes Accuracy, Precision, Recall, F1, ROC-AUC (skipped gracefully if the model can't produce probabilities or a class is missing from the test split), classification report, and confusion matrix. `save_confusion_matrix()` writes each matrix as both a PNG heatmap and a raw CSV. `build_comparison_table()` builds the final comparison DataFrame. |
| `ML/train_models.py` | The CLI entry point / orchestrator. Runs the full workflow: load data → train all registered models on the identical split → evaluate each → build the comparison table → select the best → save every model individually **and** the winner as `best_model.pkl` → write `model_comparison.csv` and `metrics.json`. Wrapped in try/except with logging throughout. |
| `ML/predict.py` | Reusable inference helpers: `load_best_model()` (loads whichever model is currently best, via `ML.utils.resolve_model_paths()`) and `predict_risk()` (adds elevation, encodes city, runs the model, decodes the risk label). This is what the backend now calls — see §3. |

### Artifacts produced by `ML/train_models.py`

```
ML/models/
├── random_forest.pkl
├── xgboost.pkl
├── lightgbm.pkl
├── best_model.pkl            ← auto-selected winner, loaded by the API
├── city_encoder.pkl
└── flood_label_encoder.pkl

ML/reports/
├── model_comparison.csv      ← one row per model, all metrics + "Selected" column
├── metrics.json              ← same data, machine-readable, incl. full classification report
└── confusion_matrices/
    ├── random_forest.png / .csv
    ├── xgboost.png / .csv
    └── lightgbm.png / .csv
```

These directories don't need to be created manually — `train_models.py` creates them on first run.

---

## 3. Existing files modified, and why

| File | Change | Reason |
|---|---|---|
| `backend/config.py` | `MODEL_FILE`, `CITY_ENCODER_FILE`, `LABEL_ENCODER_FILE` are now computed by `ML.utils.resolve_model_paths()` instead of being hardcoded to `ML_Training/...`. | **Requirement: the prediction API loads the best model automatically.** The resolver prefers `ML/models/best_model.pkl` if it exists, and falls back to the old `ML_Training/*.pkl` files if it doesn't — so the system keeps working exactly as before until the new pipeline is run for the first time. |
| `backend/predict_flood.py` | Now calls `ML.predict.load_best_model()` and `ML.predict.predict_risk()` instead of loading the `.pkl` files itself and carrying its own copy of the city→elevation dictionary. Everything else (reading `ml_features`, the upsert into `prediction_results`) is untouched. | Removes duplicated logic (the elevation map previously existed in two places) and means this script always reflects whichever model `ML/train_models.py` most recently selected as best — with no further code changes needed after retraining. |
| `backend/services/health_service.py` | The `/health` endpoint now checks `config.MODEL_FILE` instead of a hardcoded literal `"ML_Training/flood_prediction_model.pkl"`. | This was a **pre-existing bug**: health checks were pointed at a fixed legacy path, so once a new model started being used, `/health` would still report `"ml_model": "Missing"` even though a model was loaded and serving predictions fine. |
| `requirements.txt` | Rewritten as plain UTF-8 (the file was previously UTF-16 with CRLF, likely from a Windows `pip freeze` redirect). Added `xgboost`, `lightgbm`, and `matplotlib`. | The file's encoding could break tooling that expects UTF-8/ASCII. `xgboost`/`lightgbm` are required by the comparison pipeline and were missing entirely; `matplotlib` is needed to render confusion-matrix images. |
| `README.md` | Project structure diagram updated to include `ML/`. Added a "Model Comparison & Selection" section explaining how to run training and how the API picks up the result. | Keeps the top-level docs in sync with the new module. |

**Nothing else was touched** — no frontend changes, no database schema changes, no changes to `backend/app.py`, routes, or any other service.

---

## 4. How the "automatic best model" mechanism works

1. `python ML/train_models.py --train-file <csv> --test-file <csv>` trains all three models on the identical split, evaluates them, and saves the winner (by F1 Score, or whatever `--metric` you pass) to `ML/models/best_model.pkl`.
2. `backend/config.py` resolves `MODEL_FILE` at import time by checking whether `ML/models/best_model.pkl` exists:
   - **If yes** → use it (and the matching encoders in `ML/models/`).
   - **If no** → fall back to the original `ML_Training/flood_prediction_model.pkl` and its encoders.
3. `backend/predict_flood.py` (invoked by `POST /system/predict` and by the full pipeline `POST /system/run-pipeline`) always loads through this same resolver, so every prediction run automatically uses the current best model — retraining and redeploying a new winner requires no backend code changes, just re-running `ML/train_models.py`.

---

## 5. What was verified

- Full syntax check (`py_compile`) on every new/modified file.
- All new dependencies (`xgboost`, `lightgbm`, `matplotlib`) confirmed already installed in the environment.
- Ran `ML/train_models.py` end-to-end against generated synthetic data matching the real CSV schema (`City, Rainfall_3Day, Avg_Temperature, Avg_WindSpeed, Elevation, Flood_Risk`) — confirmed all six `.pkl` artifacts, `model_comparison.csv`, `metrics.json`, and all six confusion-matrix files (PNG + CSV) were produced correctly, and that the console summary and best-model selection worked.
- Confirmed `backend.config` picks up `ML/models/best_model.pkl` automatically once present, and `ML.predict.load_best_model()` + `predict_risk()` correctly loaded that model and produced predictions.
- Deleted the synthetic-data test artifacts afterward and confirmed `backend.config` correctly falls back to the original `ML_Training/flood_prediction_model.pkl` — i.e. the live system is unaffected until you retrain on your real dataset.
- Imported `backend.app` after all changes and confirmed every route (including `/health/`, `/system/predict`, `/system/run-pipeline`) still registers correctly.

---

## 6. What you need to do next

Nothing is required for the existing system to keep working — it's still running on the same legacy model as before. To start using the new comparison pipeline with your real data:

```bash
python ML/train_models.py --train-file <path to your train_dataset.csv> --test-file <path to your test_dataset.csv>
```

Optionally pick a different selection metric:

```bash
python ML/train_models.py --train-file train.csv --test-file test.csv --metric roc_auc
```

Then check `ML/reports/model_comparison.csv` to see which model won, and `ML/reports/confusion_matrices/` for the per-model confusion matrices. The backend will pick up the new `ML/models/best_model.pkl` automatically on the next prediction run — no restart-specific steps beyond a normal API restart if it's already running.
