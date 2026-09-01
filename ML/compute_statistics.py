"""
Uncertainty analysis for the baseline-relative comparison.

Reports, for the selected model and the persistence baseline:
  - macro-F1 with a 95% confidence interval
  - the paired difference with a 95% confidence interval
  - the proportion of resamples in which persistence wins
  - per-class precision / recall / F1 and the confusion matrix

Resampling is done over calendar-month blocks rather than individual
rows, because consecutive city-day records are serially dependent: the
three-day rainfall accumulation shares two of its three days with the
next record, so a row-wise bootstrap would understate the interval.

Usage:
    python ML/compute_statistics.py
    python ML/compute_statistics.py --resamples 2000
"""

import os
import sys
import json
import argparse

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import f1_score, classification_report, confusion_matrix

from backend.config import TRAIN_DATA_FILE, TEST_DATA_FILE
from ML.utils import (
    logger, ensure_dirs, save_json,
    REPORTS_DIR, BEST_MODEL_PATH, FEATURE_COLUMNS,
)

SEED = 42
PERSISTENCE_COLUMN = "Flood_Risk_Previous_Day"


def block_bootstrap(y_true, pred_a, pred_b, blocks, resamples, rng):
    """Paired block bootstrap of macro-F1 for two sets of predictions.

    Whole calendar months are resampled with replacement; both predictors
    are scored on the identical resample, so the difference is paired and
    the two sets of errors stay aligned."""

    unique_blocks = np.unique(blocks)
    index_by_block = {b: np.where(blocks == b)[0] for b in unique_blocks}

    scores_a, scores_b, deltas = [], [], []
    for _ in range(resamples):
        drawn = rng.choice(unique_blocks, size=len(unique_blocks), replace=True)
        idx = np.concatenate([index_by_block[b] for b in drawn])

        a = f1_score(y_true[idx], pred_a[idx], average="macro", zero_division=0)
        b = f1_score(y_true[idx], pred_b[idx], average="macro", zero_division=0)
        scores_a.append(a)
        scores_b.append(b)
        deltas.append(b - a)

    return np.array(scores_a), np.array(scores_b), np.array(deltas)


def ci(values):
    return float(np.percentile(values, 2.5)), float(np.percentile(values, 97.5))


def compute(train_file, test_file, resamples):
    ensure_dirs()
    rng = np.random.default_rng(SEED)

    train_df = pd.read_csv(train_file)
    test_df = pd.read_csv(test_file, parse_dates=["Date"])

    city_encoder = LabelEncoder().fit(pd.concat([train_df["City"], test_df["City"]]))
    test_df["City_Encoded"] = city_encoder.transform(test_df["City"])
    label_encoder = LabelEncoder().fit(train_df["Flood_Risk"])

    model = joblib.load(BEST_MODEL_PATH)
    model_name = type(model).__name__

    y_true = label_encoder.transform(test_df["Flood_Risk"])
    y_model = model.predict(test_df[FEATURE_COLUMNS])
    y_persist = label_encoder.transform(test_df[PERSISTENCE_COLUMN])

    blocks = test_df["Date"].dt.to_period("M").astype(str).values

    model_scores, persist_scores, deltas = block_bootstrap(
        y_true, y_model, y_persist, blocks, resamples, rng
    )

    model_f1 = f1_score(y_true, y_model, average="macro", zero_division=0)
    persist_f1 = f1_score(y_true, y_persist, average="macro", zero_division=0)
    model_lo, model_hi = ci(model_scores)
    persist_lo, persist_hi = ci(persist_scores)
    delta_lo, delta_hi = ci(deltas)

    payload = {
        "resamples": resamples,
        "block_unit": "calendar month",
        "seed": SEED,
        "model": {
            "name": model_name,
            "macro_f1": round(model_f1, 4),
            "ci_95": [round(model_lo, 4), round(model_hi, 4)],
            "per_class": classification_report(
                y_true, y_model,
                target_names=[str(c) for c in label_encoder.classes_],
                output_dict=True, zero_division=0,
            ),
            "confusion_matrix": confusion_matrix(y_true, y_model).tolist(),
        },
        "persistence": {
            "macro_f1": round(persist_f1, 4),
            "ci_95": [round(persist_lo, 4), round(persist_hi, 4)],
        },
        "paired_difference": {
            "definition": "persistence macro-F1 minus model macro-F1",
            "mean": round(float(deltas.mean()), 4),
            "ci_95": [round(delta_lo, 4), round(delta_hi, 4)],
            "excludes_zero": bool(delta_lo > 0 or delta_hi < 0),
            "persistence_wins_fraction": round(float((deltas > 0).mean()), 4),
        },
        "labels": [str(c) for c in label_encoder.classes_],
    }

    out_path = os.path.join(REPORTS_DIR, "uncertainty_analysis.json")
    save_json(payload, out_path)
    logger.info(f"Saved uncertainty analysis -> {out_path}")

    print("\n===== UNCERTAINTY ANALYSIS =====\n")
    print(f"{model_name:16s} macro-F1 = {model_f1:.4f}  95% CI [{model_lo:.4f}, {model_hi:.4f}]")
    print(f"{'Persistence':16s} macro-F1 = {persist_f1:.4f}  95% CI [{persist_lo:.4f}, {persist_hi:.4f}]")
    print()
    print(f"Paired difference (persistence - model) = {deltas.mean():.4f}  "
          f"95% CI [{delta_lo:.4f}, {delta_hi:.4f}]")
    print(f"Persistence higher in {100 * (deltas > 0).mean():.1f}% of {resamples} resamples")
    print()
    print("Per-class results for the selected model:")
    print(classification_report(
        y_true, y_model,
        target_names=[str(c) for c in label_encoder.classes_],
        digits=4, zero_division=0,
    ))
    print("Confusion matrix (rows = actual, columns = predicted):")
    print(pd.DataFrame(
        confusion_matrix(y_true, y_model),
        index=label_encoder.classes_, columns=label_encoder.classes_,
    ).to_string())

    return payload


def main():
    parser = argparse.ArgumentParser(
        description="Block-bootstrap uncertainty analysis against the persistence baseline."
    )
    parser.add_argument("--train-file", default=TRAIN_DATA_FILE)
    parser.add_argument("--test-file", default=TEST_DATA_FILE)
    parser.add_argument("--resamples", type=int, default=1000)
    args = parser.parse_args()
    compute(args.train_file, args.test_file, args.resamples)


if __name__ == "__main__":
    main()
