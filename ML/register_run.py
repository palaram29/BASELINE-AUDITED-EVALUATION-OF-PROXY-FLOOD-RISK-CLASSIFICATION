"""
Registers the most recent `python ML/train_models.py` run into Postgres
as MLOps history (ml_training_runs + one ml_model_versions row per
algorithm, all status="Candidate"), and copies each algorithm's model
file into a versioned, never-overwritten copy under
ML/models/versions/.

This is a deliberately separate, human-run step from training itself -
see docs/MLOPS.md "Registering a run into Postgres is a
separate, explicit step from training". ML/train_models.py stays
database-free (matches ML/'s existing documented principle); this is the
one file in ML/ allowed to touch Postgres, and only because a human runs
it deliberately, after reviewing the console output of the training run
it's registering.

This script never touches ML/models/best_model.pkl and never marks
anything "Production" - promotion (making a Candidate the live model) is
a separate, human-reviewed action: POST /mlops/models/{id}/promote (see
backend/services/mlops_service.py::promote_model_version), or run this
script and then promote via the API/dashboard.

Usage:
    python ML/train_models.py --train-file <train.csv> --test-file <test.csv>
    python ML/register_run.py
"""

import os
import sys
import json
import shutil

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

from ML.utils import (
    logger,
    ensure_dirs,
    MODELS_DIR,
    MODEL_VERSIONS_DIR,
    METRICS_JSON,
)
from ML.model_selector import MODEL_FILENAMES

from database.db_connection import get_engine, ensure_mlops_tables


def _load_json(path):
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"{path} not found - run `python ML/train_models.py` first."
        )
    with open(path, "r") as f:
        return json.load(f)


def _next_version(conn, algorithm):
    result = conn.execute(
        text("SELECT COALESCE(MAX(version), 0) FROM ml_model_versions WHERE algorithm = :algo"),
        {"algo": algorithm},
    ).scalar()
    return result + 1


def register_latest_run():
    ensure_dirs()
    ensure_mlops_tables()

    metrics = _load_json(METRICS_JSON)

    engine = get_engine()
    registered = []

    with engine.begin() as conn:
        training_run_id = conn.execute(
            text("""
                INSERT INTO ml_training_runs
                    (mlflow_run_id, train_file, test_file, dataset_train_rows,
                     dataset_test_rows, selection_metric, duration_sec)
                VALUES
                    (:mlflow_run_id, :train_file, :test_file, :train_rows,
                     :test_rows, :selection_metric, :duration_sec)
                RETURNING id
            """),
            {
                "mlflow_run_id": metrics.get("mlflow_run_id"),
                "train_file": metrics.get("train_file"),
                "test_file": metrics.get("test_file"),
                "train_rows": metrics.get("dataset", {}).get("train_rows"),
                "test_rows": metrics.get("dataset", {}).get("test_rows"),
                "selection_metric": metrics.get("selection_metric"),
                "duration_sec": metrics.get("training_duration_sec"),
            },
        ).scalar()

        for algorithm, model_metrics in metrics.get("models", {}).items():
            if model_metrics.get("status") == "Baseline":
                continue

            source_filename = MODEL_FILENAMES.get(algorithm)
            if not source_filename:
                logger.warning(f"No known model file for '{algorithm}' - skipping registration")
                continue

            source_path = os.path.join(MODELS_DIR, source_filename)
            if not os.path.exists(source_path):
                logger.warning(f"Model file missing for '{algorithm}' ({source_path}) - skipping")
                continue

            version = _next_version(conn, algorithm)
            versioned_filename = f"v{version}_{algorithm}.pkl"
            versioned_path = os.path.join(MODEL_VERSIONS_DIR, versioned_filename)
            shutil.copy2(source_path, versioned_path)

            conn.execute(
                text("""
                    INSERT INTO ml_model_versions
                        (training_run_id, algorithm, version, mlflow_run_id, status,
                         artifact_path, accuracy, macro_f1, high_risk_recall,
                         extreme_risk_recall, roc_auc, selection_reason, metrics_json)
                    VALUES
                        (:training_run_id, :algorithm, :version, :mlflow_run_id, 'Candidate',
                         :artifact_path, :accuracy, :macro_f1, :high_risk_recall,
                         :extreme_risk_recall, :roc_auc, :selection_reason, :metrics_json)
                """),
                {
                    "training_run_id": training_run_id,
                    "algorithm": algorithm,
                    "version": version,
                    "mlflow_run_id": model_metrics.get("mlflow_run_id"),
                    "artifact_path": versioned_path,
                    "accuracy": model_metrics.get("accuracy"),
                    "macro_f1": model_metrics.get("macro_f1"),
                    "high_risk_recall": model_metrics.get("high_risk_recall"),
                    "extreme_risk_recall": model_metrics.get("extreme_risk_recall"),
                    "roc_auc": model_metrics.get("roc_auc"),
                    "selection_reason": (
                        metrics.get("selection_reason")
                        if algorithm == metrics.get("best_model") else None
                    ),
                    "metrics_json": json.dumps(model_metrics, default=str),
                },
            )

            registered.append((algorithm, version, versioned_path))
            logger.info(f"Registered {algorithm} v{version} -> {versioned_path}")

    return training_run_id, registered


def main():
    try:
        training_run_id, registered = register_latest_run()
    except Exception as exc:
        logger.error(f"register_run failed: {exc}")
        print(f"register_run failed: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"\nRegistered training run #{training_run_id} with {len(registered)} candidate version(s):\n")
    for algorithm, version, path in registered:
        print(f"  {algorithm} v{version} -> {path}")
    print(
        "\nAll registered as status=Candidate. Review their metrics on the "
        "MLOps dashboard (/mlops), then promote whichever version should "
        "go live via POST /mlops/models/{id}/promote - this script never "
        "changes ML/models/best_model.pkl itself."
    )


if __name__ == "__main__":
    main()
