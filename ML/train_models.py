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
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import joblib

from backend.config import TRAIN_DATA_FILE, TEST_DATA_FILE
from ML.utils import (
    logger,
    ensure_dirs,
    prepare_data,
    save_json,
    MODELS_DIR,
    BEST_MODEL_PATH,
    CITY_ENCODER_PATH,
    LABEL_ENCODER_PATH,
    MODEL_COMPARISON_CSV,
    METRICS_JSON,
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

    run_start = time.time()
    logger.info("===== MODEL COMPARISON PIPELINE STARTED =====")

    (
        X_train, X_test, y_train, y_test,
        city_encoder, label_encoder
    ) = prepare_data(train_file, test_file)

    results = []

    for model_name, build_model in get_model_registry().items():
        try:
            model = build_model()
            result = evaluate_model(
                model, model_name,
                X_train, X_test, y_train, y_test,
                label_encoder
            )
            results.append(result)

            model_path = os.path.join(MODELS_DIR, MODEL_FILENAMES[model_name])
            joblib.dump(model, model_path)
            logger.info(f"Saved {model_name} -> {model_path}")

            save_confusion_matrix(
                result["confusion_matrix"], result["labels"], model_name
            )

        except Exception as exc:
            logger.error(f"Training/evaluation failed for {model_name}: {exc}")

    if not results:
        raise RuntimeError("All models failed to train - see logs/ml_pipeline.log")

    best_result = select_best_model(results, metric=metric)

    # Save best model + both encoders (the artifacts the prediction API loads).
    joblib.dump(best_result["model"], BEST_MODEL_PATH)
    joblib.dump(city_encoder, CITY_ENCODER_PATH)
    joblib.dump(label_encoder, LABEL_ENCODER_PATH)
    logger.info(f"Saved best model ({best_result['name']}) -> {BEST_MODEL_PATH}")

    # Reports: comparison table + machine-readable metrics.
    comparison_df = build_comparison_table(results, best_result["name"])
    comparison_df.to_csv(MODEL_COMPARISON_CSV, index=False)
    logger.info(f"Saved comparison table -> {MODEL_COMPARISON_CSV}")

    metrics_payload = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "selection_metric": metric,
        "best_model": best_result["name"],
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
                "roc_auc": r["roc_auc"],
                "training_time_sec": r["training_time"],
                "prediction_time_sec": r["prediction_time"],
                "confusion_matrix": r["confusion_matrix"].tolist(),
                "labels": r["labels"],
                "classification_report": r["classification_report"],
                "feature_importance": r["feature_importance"],
                "status": r["status"],
            }
            for r in results
        },
    }
    save_json(metrics_payload, METRICS_JSON)
    logger.info(f"Saved metrics -> {METRICS_JSON}")

    logger.info("===== MODEL COMPARISON PIPELINE COMPLETED =====")

    return results, best_result, comparison_df


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
