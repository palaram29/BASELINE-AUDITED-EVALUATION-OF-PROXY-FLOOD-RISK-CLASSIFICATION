"""
Train and compare Random Forest, XGBoost and LightGBM on the same
dataset, preprocessing pipeline and train/test split, then save the
best-performing model (plus both encoders) for the prediction API to
pick up automatically.

Usage:
    python ML/train_models.py --train-file <path/to/train.csv> --test-file <path/to/test.csv>
    python ML/train_models.py --train-file train.csv --test-file test.csv --metric roc_auc

Adding a new algorithm later is a one-line change in
ML/model_selector.py's MODEL_REGISTRY - this script does not need to
change.
"""

import os
import sys
import time
import argparse
import contextlib
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import joblib
import pandas as pd

try:
    import mlflow
    import mlflow.sklearn
    MLFLOW_AVAILABLE = True
except ImportError:
    MLFLOW_AVAILABLE = False

from backend.config import TRAIN_DATA_FILE, TEST_DATA_FILE
from ML.utils import (
    logger,
    ensure_dirs,
    prepare_data,
    save_json,
    compute_feature_distribution,
    MODELS_DIR,
    BEST_MODEL_PATH,
    CITY_ENCODER_PATH,
    LABEL_ENCODER_PATH,
    MODEL_COMPARISON_CSV,
    METRICS_JSON,
    PRODUCTION_MODEL_JSON,
    FEATURE_BASELINE_JSON,
    FEATURE_COLUMNS,
)
from ML.model_selector import (
    get_model_registry,
    select_best_model,
    MODEL_FILENAMES,
    DEFAULT_SELECTION_METRIC,
    SELECTABLE_METRICS,
)
from ML.evaluate_models import (
    evaluate_model,
    save_confusion_matrix,
    build_comparison_table,
)

# Majority/Persistence/Seasonal baselines are intentionally NOT part of
# this pipeline - by research decision, the core comparison and the
# production dashboard/prediction pipeline only ever consider Random
# Forest, XGBoost and LightGBM. The baselines still exist in ML/baselines.py
# and are used by ML/walkforward_validate.py as a separate, optional
# methodology check (see docs/ML_METHODOLOGY_AND_LIMITATIONS.md) - they
# are not recomputed or reported here.


MLFLOW_EXPERIMENT_NAME = "flood-risk-classifier"
MLFLOW_REGISTERED_MODEL_NAME = "flood-risk-classifier"


def _mlflow_setup():
    """Point MLflow at a local SQLite-backed tracking store by default
    (MLFLOW_TRACKING_URI overrides this) - no separate server process to
    run, full Model Registry support. See docs/MLOPS_INTEGRATION_PLAN.md.
    Never raises: MLflow is an additive tracking layer, not a training
    dependency - if setup fails, training below still runs exactly as it
    did before this was added, just without MLflow logging."""

    if not MLFLOW_AVAILABLE:
        logger.warning("mlflow not installed - training will run without MLflow tracking")
        return
    try:
        mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "sqlite:///mlflow.db"))
        mlflow.set_experiment(MLFLOW_EXPERIMENT_NAME)
    except Exception as exc:
        logger.warning(f"MLflow setup failed, continuing without MLflow tracking: {exc}")


def _mlflow_start_run(**kwargs):
    """mlflow.start_run(), or a no-op context manager if MLflow is
    unavailable/unhealthy - callers can always `with _mlflow_start_run():`
    unconditionally."""

    if not MLFLOW_AVAILABLE:
        return contextlib.nullcontext()
    try:
        return mlflow.start_run(**kwargs)
    except Exception as exc:
        logger.warning(f"MLflow start_run failed, continuing without MLflow tracking: {exc}")
        return contextlib.nullcontext()


def _mlflow_safe(fn, *args, **kwargs):
    """Run one MLflow logging call, swallowing any failure - a transient
    MLflow error must never fail the actual training/comparison run."""

    if not MLFLOW_AVAILABLE:
        return
    try:
        fn(*args, **kwargs)
    except Exception as exc:
        logger.warning(f"MLflow logging call failed (non-fatal): {exc}")


def _active_run_id():
    if not MLFLOW_AVAILABLE:
        return None
    try:
        run = mlflow.active_run()
        return run.info.run_id if run else None
    except Exception:
        return None


def _model_params(model):
    """Real hyperparameters straight from the fitted estimator - not
    hardcoded, so this can't drift out of sync with ML/model_selector.py's
    MODEL_REGISTRY. get_params() is available on every sklearn/xgboost/
    lightgbm estimator used here."""

    try:
        return {k: v for k, v in model.get_params().items() if v is not None}
    except Exception:
        return {}


def _date_range(csv_path):
    """Min/max Date in a dataset CSV, for the frozen manifest's
    training_period field. Reads only the Date column - cheap even for
    the full historical file."""

    dates = pd.to_datetime(pd.read_csv(csv_path, usecols=["Date"])["Date"])
    return dates.min().strftime("%Y-%m-%d"), dates.max().strftime("%Y-%m-%d")


def _build_production_manifest(best_result, metrics_payload, train_file, test_file):
    """Freeze the selected model as the production artifact.

    This is the one-time record of "what got deployed and why" - model
    identity, exact feature list, dataset provenance and the metrics that
    justified the pick. Written once per (human-triggered) run of this
    script; the live system only ever reads it, never regenerates it -
    see docs/ML_METHODOLOGY_AND_LIMITATIONS.md "Production deployment:
    frozen model policy".
    """

    model_name = best_result["name"]
    train_start, train_end = _date_range(train_file)
    test_start, test_end = _date_range(test_file)
    model_metrics = metrics_payload["models"][model_name]

    return {
        "model": model_name,
        # Bumped by hand on each deliberate, reviewed re-run of this
        # script (see retraining_policy below) - not auto-incremented,
        # since a version bump should reflect a human having reviewed the
        # new metrics, not just that the script ran again. v1.1: XGBoost/
        # LightGBM regularization fix (see ML/model_selector.py) - the
        # selected model/weights are unchanged (still RandomForest v1.0's
        # exact result), but the comparison the selection was made
        # against is not, so the manifest reflects a new frozen event.
        "version": "1.1",
        "status": "frozen",
        "frozen_at": metrics_payload["trained_at"],
        "selection_reason": best_result.get("selection_reason"),
        "training_period": f"{train_start[:4]}-{test_end[:4]}",
        "dataset": {
            "train_rows": metrics_payload["dataset"]["train_rows"],
            "test_rows": metrics_payload["dataset"]["test_rows"],
            "train_date_range": f"{train_start} to {train_end}",
            "test_date_range": f"{test_start} to {test_end}",
        },
        "features": ["City" if f == "City_Encoded" else f for f in FEATURE_COLUMNS],
        "evaluation_metrics": {
            "accuracy": model_metrics["accuracy"],
            "macro_precision": model_metrics["macro_precision"],
            "macro_recall": model_metrics["macro_recall"],
            "macro_f1": model_metrics["macro_f1"],
            "weighted_f1": model_metrics["f1_score"],
            "high_risk_recall": model_metrics["high_risk_recall"],
            "extreme_risk_recall": model_metrics["extreme_risk_recall"],
            "roc_auc": model_metrics["roc_auc"],
        },
        "artifacts": {
            "model_file": os.path.relpath(BEST_MODEL_PATH, MODELS_DIR),
            "city_encoder_file": os.path.relpath(CITY_ENCODER_PATH, MODELS_DIR),
            "label_encoder_file": os.path.relpath(LABEL_ENCODER_PATH, MODELS_DIR),
        },
        "retraining_policy": (
            "Frozen for production inference. Not retrained automatically, "
            "on a schedule, or in response to live data. Retraining requires "
            "a deliberate manual re-run of ML/train_models.py, followed by "
            "review of the new metrics before redeployment."
        ),
    }


def train_and_compare(train_file, test_file, metric=DEFAULT_SELECTION_METRIC):
    """Run the full compare-train-evaluate-select-save workflow.

    Returns (results, best_result) where `results` is a list of per-model
    evaluation dicts and `best_result` is the winning entry.
    """

    ensure_dirs()

    if not os.path.exists(train_file):
        raise FileNotFoundError(f"Train file not found: {train_file}")
    if not os.path.exists(test_file):
        raise FileNotFoundError(f"Test file not found: {test_file}")

    _mlflow_setup()

    run_start = time.time()
    logger.info("===== MODEL COMPARISON PIPELINE STARTED =====")

    (
        X_train, X_test, y_train, y_test,
        city_encoder, label_encoder
    ) = prepare_data(train_file, test_file)

    # Per-feature training-distribution baseline, for live drift
    # monitoring (backend/services/mlops_service.py) - computed from
    # these exact rows, not recomputed elsewhere. Written unconditionally
    # (not inside the MLflow try/except below) since it's a plain JSON
    # file write with no external dependency.
    feature_baseline = {
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "train_rows": len(X_train),
        "features": compute_feature_distribution(X_train),
    }
    save_json(feature_baseline, FEATURE_BASELINE_JSON)
    logger.info(f"Saved feature baseline -> {FEATURE_BASELINE_JSON}")

    model_results = []
    model_mlflow_run_ids = {}

    with _mlflow_start_run(run_name=f"compare-{datetime.now(timezone.utc):%Y%m%dT%H%M%S}") as parent_run:
        parent_run_id = _active_run_id()

        for model_name, build_model in get_model_registry().items():
            try:
                model = build_model()
                result = evaluate_model(
                    model, model_name,
                    X_train, X_test, y_train, y_test,
                    label_encoder
                )
                model_results.append(result)

                model_path = os.path.join(MODELS_DIR, MODEL_FILENAMES[model_name])
                joblib.dump(model, model_path)
                logger.info(f"Saved {model_name} -> {model_path}")

                png_path, csv_path = save_confusion_matrix(
                    result["confusion_matrix"], result["labels"], model_name
                )

                with _mlflow_start_run(run_name=model_name, nested=True) as nested_run:
                    model_mlflow_run_ids[model_name] = _active_run_id()
                    if MLFLOW_AVAILABLE:
                        _mlflow_safe(mlflow.log_params, _model_params(model))
                        _mlflow_safe(mlflow.log_metrics, {
                            k: v for k, v in {
                                "accuracy": result["accuracy"],
                                "precision": result["precision"],
                                "recall": result["recall"],
                                "f1_score": result["f1_score"],
                                "macro_precision": result["macro_precision"],
                                "macro_recall": result["macro_recall"],
                                "macro_f1": result["macro_f1"],
                                "high_risk_recall": result["high_risk_recall"],
                                "extreme_risk_recall": result["extreme_risk_recall"],
                                "roc_auc": result["roc_auc"],
                                "training_time_sec": result["training_time"],
                                "prediction_time_sec": result["prediction_time"],
                            }.items() if v is not None
                        })
                        _mlflow_safe(mlflow.sklearn.log_model, model, model_name)
                        _mlflow_safe(mlflow.log_artifact, png_path)
                        _mlflow_safe(mlflow.log_artifact, csv_path)

            except Exception as exc:
                logger.error(f"Training/evaluation failed for {model_name}: {exc}")

        if not model_results:
            raise RuntimeError("All models failed to train - see logs/ml_pipeline.log")

        best_result = select_best_model(model_results, metric=metric)

        # Save best model + both encoders (the artifacts the prediction API loads).
        joblib.dump(best_result["model"], BEST_MODEL_PATH)
        joblib.dump(city_encoder, CITY_ENCODER_PATH)
        joblib.dump(label_encoder, LABEL_ENCODER_PATH)
        logger.info(f"Saved best model ({best_result['name']}) -> {BEST_MODEL_PATH}")

        # Reports: comparison table + machine-readable metrics. RF/XGBoost/
        # LightGBM only - see the note at the top of this file.
        comparison_df = build_comparison_table(model_results, best_result["name"])
        comparison_df.to_csv(MODEL_COMPARISON_CSV, index=False)
        logger.info(f"Saved comparison table -> {MODEL_COMPARISON_CSV}")

        metrics_payload = {
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "selection_metric": metric,
            "best_model": best_result["name"],
            "selection_reason": best_result.get("selection_reason"),
            "mlflow_run_id": parent_run_id,
            "train_file": train_file,
            "test_file": test_file,
            "dataset": {
                "train_rows": len(X_train),
                "test_rows": len(X_test),
            },
            "training_duration_sec": time.time() - run_start,
            "models": {
                r["name"]: {
                    "accuracy": r["accuracy"],
                    "precision": r["precision"],
                    "recall": r["recall"],
                    "f1_score": r["f1_score"],
                    "macro_precision": r["macro_precision"],
                    "macro_recall": r["macro_recall"],
                    "macro_f1": r["macro_f1"],
                    "high_risk_recall": r["high_risk_recall"],
                    "extreme_risk_recall": r["extreme_risk_recall"],
                    "roc_auc": r["roc_auc"],
                    "training_time_sec": r["training_time"],
                    "prediction_time_sec": r["prediction_time"],
                    "confusion_matrix": r["confusion_matrix"].tolist(),
                    "labels": r["labels"],
                    "classification_report": r["classification_report"],
                    "feature_importance": r["feature_importance"],
                    "status": r["status"],
                    "mlflow_run_id": model_mlflow_run_ids.get(r["name"]),
                }
                for r in model_results
            },
        }
        save_json(metrics_payload, METRICS_JSON)
        logger.info(f"Saved metrics -> {METRICS_JSON}")

        production_payload = _build_production_manifest(
            best_result, metrics_payload, train_file, test_file
        )
        save_json(production_payload, PRODUCTION_MODEL_JSON)
        logger.info(
            f"Froze production model ({best_result['name']}) -> {PRODUCTION_MODEL_JSON}"
        )

        if MLFLOW_AVAILABLE:
            _mlflow_safe(mlflow.set_tag, "best_model", best_result["name"])
            _mlflow_safe(mlflow.log_artifact, METRICS_JSON)
            _mlflow_safe(mlflow.log_artifact, MODEL_COMPARISON_CSV)
            _mlflow_safe(mlflow.log_artifact, PRODUCTION_MODEL_JSON)
            _mlflow_safe(mlflow.log_artifact, FEATURE_BASELINE_JSON)
            _mlflow_safe(
                mlflow.sklearn.log_model,
                best_result["model"], "best_model",
                registered_model_name=MLFLOW_REGISTERED_MODEL_NAME,
            )

    logger.info("===== MODEL COMPARISON PIPELINE COMPLETED =====")

    return model_results, best_result, comparison_df


def _print_summary(comparison_df, best_result):
    print("\n===== MODEL COMPARISON TABLE =====\n")
    print(comparison_df.to_string(index=False))
    print("\n===================================")
    print(f"Best Model ({DEFAULT_SELECTION_METRIC} unless overridden): {best_result['name']}")
    print(f"Artifacts saved to: {MODELS_DIR}")


def main():
    parser = argparse.ArgumentParser(description="Train and compare flood-risk models.")
    parser.add_argument(
        "--train-file", default=TRAIN_DATA_FILE,
        help=f"Path to the training CSV (default: {TRAIN_DATA_FILE})."
    )
    parser.add_argument(
        "--test-file", default=TEST_DATA_FILE,
        help=f"Path to the test CSV (default: {TEST_DATA_FILE})."
    )
    parser.add_argument(
        "--metric",
        default=DEFAULT_SELECTION_METRIC,
        choices=SELECTABLE_METRICS,
        help="Metric used to pick the best model (default: f1_score)."
    )
    args = parser.parse_args()

    try:
        results, best_result, comparison_df = train_and_compare(
            args.train_file, args.test_file, metric=args.metric
        )
    except Exception as exc:
        logger.error(f"Training pipeline failed: {exc}")
        print(f"Training pipeline failed: {exc}", file=sys.stderr)
        sys.exit(1)

    _print_summary(comparison_df, best_result)


if __name__ == "__main__":
    main()
