"""
Degraded-data research experiments - see §10-11 of the Data Source
Reliability integration.

Tests the research hypothesis (§17): "Reliability-aware environmental data
processing can improve the robustness of ML-based flood prediction when
environmental data becomes incomplete, delayed, invalid, or degraded."

For each of 6 conditions (normal, missing_10/20/30, delayed, invalid) x 2
feature configurations (baseline, reliability_aware) x 3 algorithms
(RandomForest, XGBoost, LightGBM):
  1. Take an IN-MEMORY COPY of the test split and apply the condition via
     reliability/degradation.py (pure, non-mutating - the original
     ML/data/test_dataset.csv is never touched).
  2. Recompute Weather_Reliability/River_Reliability/Overall_Data_Reliability
     on the degraded copy so the reliability-aware config's extra features
     genuinely reflect the injected degradation, not the original clean
     values.
  3. Train on the SAME original (non-degraded) training split for every
     condition, evaluate on the degraded test copy, via the existing
     ML/evaluate_models.evaluate_model (accuracy/precision/recall/f1/
     roc-auc/confusion-matrix/high-risk-recall - reused, not reimplemented).

Writes ML/reports/reliability_experiments/comparison_table.csv (+ .json,
+ per-condition confusion matrices) - real, computed results. Nothing in
ML/reports/ (outside this subfolder), ML/models/, or ML/data/*.csv is
touched.

Usage:
    python ML/run_reliability_experiments.py
    python ML/run_reliability_experiments.py --train-file ... --test-file ...
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from sklearn.preprocessing import LabelEncoder

from backend.config import TRAIN_DATA_FILE, TEST_DATA_FILE
from ML.utils import (
    logger,
    ensure_dirs,
    REPORTS_DIR,
    BASELINE_FEATURE_COLUMNS,
    RELIABILITY_FEATURE_COLUMNS,
)
from ML.model_selector import get_model_registry
from ML.evaluate_models import evaluate_model, save_confusion_matrix

from reliability import config as rcfg
from reliability.degradation import simulate_missing, simulate_delay, simulate_invalid
from reliability.timeliness import compute_timeliness
from reliability.validity import validate_temperature, validate_windspeed
from reliability.scorer import compute_reliability

EXPERIMENT_REPORTS_DIR = os.path.join(REPORTS_DIR, "reliability_experiments")
EXPERIMENT_CONFUSION_DIR = os.path.join(EXPERIMENT_REPORTS_DIR, "confusion_matrices")

DEGRADED_ENV_COLUMNS = ["Rainfall_3Day", "Avg_Temperature", "Avg_WindSpeed"]

FEATURE_SETS = {
    "baseline": BASELINE_FEATURE_COLUMNS,
    "reliability_aware": RELIABILITY_FEATURE_COLUMNS,
}

CONDITIONS = {
    "normal": {"kind": "none"},
    "missing_10": {"kind": "missing", "pct": 10},
    "missing_20": {"kind": "missing", "pct": 20},
    "missing_30": {"kind": "missing", "pct": 30},
    "delayed": {"kind": "delayed", "minutes": 240, "pct": 50},
    "invalid": {"kind": "invalid", "pct": 10},
}

REPORT_METRICS = ("accuracy", "macro_f1", "high_risk_recall", "extreme_risk_recall")


def _apply_condition(test_df, condition, random_state=42):
    """Non-destructive: returns a NEW DataFrame (+ the delay column name,
    if any). `test_df` itself is never modified. random_state is threaded
    through to reliability/degradation.py's simulators (default 42,
    unchanged from before) so ML/run_reliability_experiments_multiseed.py
    can rerun every condition under different injected-degradation draws
    without touching this function's default single-seed behaviour."""

    kind = condition["kind"]
    if kind == "none":
        return test_df.copy(), None
    if kind == "missing":
        return simulate_missing(test_df, condition["pct"], columns=DEGRADED_ENV_COLUMNS, random_state=random_state), None
    if kind == "invalid":
        return simulate_invalid(test_df, condition["pct"], columns=DEGRADED_ENV_COLUMNS, random_state=random_state), None
    if kind == "delayed":
        degraded = simulate_delay(test_df, minutes=condition["minutes"], pct=condition["pct"], random_state=random_state)
        return degraded, "simulated_delay_minutes"
    raise ValueError(f"Unknown condition kind: {kind}")


def _recompute_reliability_features(df, delay_column):
    """Recompute Weather_Reliability/River_Reliability/Overall_Data_Reliability
    on a degraded test copy so they genuinely reflect the injected
    degradation, using the same reliability/ scoring engine as the live
    pipeline and ML/prepare_dataset.py.

    Historical Reliability uses the neutral prior for every row: each
    condition here is an isolated snapshot, not a continuing time series,
    so there is no meaningful "past" to build an EMA from - these
    experiments measure the IMMEDIATE impact of one degraded cycle, not
    accumulated historical drift. Documented simplification, consistent
    with this dataset's other documented gaps (see ML/prepare_dataset.py's
    attach_reliability_features docstring)."""

    df = df.copy()

    present = df[DEGRADED_ENV_COLUMNS].notna()
    completeness = present.sum(axis=1) / len(DEGRADED_ENV_COLUMNS)

    rainfall_valid = df["Rainfall_3Day"].apply(
        lambda v: pd.notna(v) and 0 <= float(v) <= rcfg.RAINFALL_3DAY_MAX
    )
    temp_valid = df["Avg_Temperature"].apply(lambda v: pd.notna(v) and validate_temperature(v)[0])
    wind_valid = df["Avg_WindSpeed"].apply(lambda v: pd.notna(v) and validate_windspeed(v)[0])
    validity = (rainfall_valid.astype(int) + temp_valid.astype(int) + wind_valid.astype(int)) / 3

    if delay_column and delay_column in df.columns:
        reference = datetime(2000, 1, 1)
        timeliness = df[delay_column].apply(
            lambda d: compute_timeliness(reference + timedelta(minutes=float(d)), reference)
        )
    else:
        timeliness = pd.Series(1.0, index=df.index)

    historical = rcfg.HISTORICAL_RELIABILITY_DEFAULT
    weather_reliability = [
        compute_reliability(completeness=c, timeliness=t, validity=v, historical=historical)["reliability_score"]
        for c, t, v in zip(completeness, timeliness, validity)
    ]

    df["Weather_Reliability"] = weather_reliability
    # No river data exists in this offline dataset to degrade (see
    # ML/prepare_dataset.py) - stays at the neutral prior in every
    # condition, same as the undegraded dataset.
    df["River_Reliability"] = rcfg.HISTORICAL_RELIABILITY_DEFAULT
    df["Overall_Data_Reliability"] = (
        rcfg.WEATHER_SOURCE_WEIGHT * df["Weather_Reliability"]
        + rcfg.RIVER_SOURCE_WEIGHT * df["River_Reliability"]
    )

    return df


def run_experiments(train_file=TRAIN_DATA_FILE, test_file=TEST_DATA_FILE):
    ensure_dirs()
    os.makedirs(EXPERIMENT_REPORTS_DIR, exist_ok=True)
    os.makedirs(EXPERIMENT_CONFUSION_DIR, exist_ok=True)

    if not os.path.exists(train_file):
        raise FileNotFoundError(f"Train file not found: {train_file}")
    if not os.path.exists(test_file):
        raise FileNotFoundError(f"Test file not found: {test_file}")

    train_df = pd.read_csv(train_file)
    test_df_original = pd.read_csv(test_file)

    city_encoder = LabelEncoder()
    city_encoder.fit(pd.concat([train_df["City"], test_df_original["City"]], ignore_index=True))
    train_df = train_df.copy()
    train_df["City_Encoded"] = city_encoder.transform(train_df["City"])

    label_encoder = LabelEncoder()
    y_train = label_encoder.fit_transform(train_df["Flood_Risk"])

    summary_rows = []
    detailed = {}

    for condition_name, condition in CONDITIONS.items():
        degraded_test_df, delay_column = _apply_condition(test_df_original, condition)
        degraded_test_df = _recompute_reliability_features(degraded_test_df, delay_column)
        degraded_test_df["City_Encoded"] = city_encoder.transform(degraded_test_df["City"])
        y_test = label_encoder.transform(degraded_test_df["Flood_Risk"])

        for config_name, feature_columns in FEATURE_SETS.items():
            X_train = train_df[feature_columns]
            X_test = degraded_test_df[feature_columns]

            # Missing values from the 'missing_*' conditions would crash
            # .predict() outright - impute with each feature's TRAINING-set
            # median (fit on train only, applied to test - no leakage),
            # mirroring how a real deployment handles an incomplete live
            # observation instead of failing the whole prediction.
            medians = X_train.median(numeric_only=True)
            X_test_imputed = X_test.fillna(medians)

            for model_name, build_model in get_model_registry().items():
                model = build_model()
                result = evaluate_model(
                    model, model_name, X_train, X_test_imputed, y_train, y_test, label_encoder
                )

                summary_rows.append({
                    "condition": condition_name,
                    "feature_set": config_name,
                    "model": model_name,
                    "accuracy": result["accuracy"],
                    "macro_precision": result["macro_precision"],
                    "macro_recall": result["macro_recall"],
                    "macro_f1": result["macro_f1"],
                    "weighted_f1": result["f1_score"],
                    "high_risk_recall": result["high_risk_recall"],
                    "extreme_risk_recall": result["extreme_risk_recall"],
                    "roc_auc": result["roc_auc"],
                })

                detailed.setdefault(condition_name, {}).setdefault(config_name, {})[model_name] = {
                    "confusion_matrix": result["confusion_matrix"].tolist(),
                    "labels": result["labels"],
                    "classification_report": result["classification_report"],
                }

                save_confusion_matrix(
                    result["confusion_matrix"], result["labels"],
                    f"{model_name}_{config_name}",
                    output_dir=os.path.join(EXPERIMENT_CONFUSION_DIR, condition_name),
                )

        logger.info(f"Reliability experiment: completed condition '{condition_name}'")

    summary_df = pd.DataFrame(summary_rows)
    summary_csv = os.path.join(EXPERIMENT_REPORTS_DIR, "comparison_table.csv")
    summary_df.to_csv(summary_csv, index=False)

    summary_json = os.path.join(EXPERIMENT_REPORTS_DIR, "comparison_table.json")
    with open(summary_json, "w") as f:
        json.dump(
            {
                "computed_at": datetime.now(timezone.utc).isoformat(),
                "conditions": list(CONDITIONS.keys()),
                "feature_sets": {k: list(v) for k, v in FEATURE_SETS.items()},
                "summary": summary_rows,
                "detailed": detailed,
            },
            f, indent=2, default=str,
        )

    logger.info(f"Saved degraded-data experiment results -> {summary_csv} / {summary_json}")

    return summary_df


def build_pivot_tables(summary_df, metrics=REPORT_METRICS):
    """One pivot table per metric: rows=(Model, feature_set), columns=condition -
    the exact layout requested in §11."""

    tables = {}
    for metric in metrics:
        pivot = summary_df.pivot_table(
            index=["model", "feature_set"], columns="condition", values=metric
        )
        pivot = pivot.reindex(columns=list(CONDITIONS.keys()))
        tables[metric] = pivot
    return tables


def main():
    parser = argparse.ArgumentParser(description="Run degraded-data reliability experiments.")
    parser.add_argument("--train-file", default=TRAIN_DATA_FILE)
    parser.add_argument("--test-file", default=TEST_DATA_FILE)
    args = parser.parse_args()

    try:
        summary_df = run_experiments(args.train_file, args.test_file)
    except Exception as exc:
        logger.error(f"Reliability experiment pipeline failed: {exc}")
        print(f"Reliability experiment pipeline failed: {exc}", file=sys.stderr)
        sys.exit(1)

    tables = build_pivot_tables(summary_df)
    for metric, table in tables.items():
        print(f"\n===== {metric} (Baseline vs. Reliability-aware, by condition) =====\n")
        print(table.round(4).to_string())

    print(f"\nFull results: {EXPERIMENT_REPORTS_DIR}/comparison_table.csv")


if __name__ == "__main__":
    main()
