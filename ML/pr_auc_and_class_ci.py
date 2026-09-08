"""
PR-AUC and per-class confidence intervals (supervisor review, Priority 5).

ML/compute_statistics.py already reports macro-F1 with a 95% CI and a
per-class classification_report (precision/recall/F1), but two things
the reviewer specifically asked for are still missing:

  1. PR-AUC (average precision) per class - more informative than
     ROC-AUC under the severe class imbalance here (Extreme is a small
     minority class), since PR-AUC does not credit a classifier for
     correctly predicting the very large "Low" class.
  2. A 95% CI specifically on High and Extreme RECALL - these are the
     two classes an early-warning system cares about most (missing a
     real High/Extreme case is the costly error), and the existing
     macro-F1 CI does not tell you how uncertain those two numbers are
     on their own. The test set has very few Extreme rows, so this
     interval is expected to be wide - reporting it honestly, not just
     the point estimate, is the point of this script.

Uses the SAME frozen production model and test_dataset.csv as
ML/compute_statistics.py, and the same calendar-month block bootstrap
methodology (consecutive city-day records are serially dependent via
the 3-day rolling rainfall window, so a row-wise bootstrap would
understate the interval - see that script's docstring). Does not
retrain anything or touch train_dataset.csv / test_dataset.csv. Writes
its own results file only.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder, label_binarize
from sklearn.metrics import average_precision_score, recall_score

from backend.config import TRAIN_DATA_FILE, TEST_DATA_FILE
from ML.utils import logger, REPORTS_DIR, BEST_MODEL_PATH, FEATURE_COLUMNS

RESULTS_JSON = os.path.join(REPORTS_DIR, "pr_auc_and_class_ci.json")
SEED = 42
RESAMPLES = 2000
FOCUS_CLASSES = ["High", "Extreme"]


def per_class_pr_auc(y_true_bin, y_proba, class_names):
    """One-vs-rest average precision per class."""
    out = {}
    for i, name in enumerate(class_names):
        out[name] = round(float(average_precision_score(y_true_bin[:, i], y_proba[:, i])), 4)
    return out


def block_bootstrap_recall(y_true, y_pred, blocks, class_idx, resamples, rng):
    """Block bootstrap of recall for a single class, resampling whole
    calendar months with replacement (same block unit as
    ML/compute_statistics.py)."""

    unique_blocks = np.unique(blocks)
    index_by_block = {b: np.where(blocks == b)[0] for b in unique_blocks}

    scores = []
    for _ in range(resamples):
        drawn = rng.choice(unique_blocks, size=len(unique_blocks), replace=True)
        idx = np.concatenate([index_by_block[b] for b in drawn])

        mask = y_true[idx] == class_idx
        if mask.sum() == 0:
            continue  # this resample happened to draw zero rows of this class
        r = recall_score(y_true[idx], y_pred[idx], labels=[class_idx], average="micro", zero_division=0)
        scores.append(r)

    return np.array(scores)


def ci(values):
    return float(np.percentile(values, 2.5)), float(np.percentile(values, 97.5))


def main():
    rng = np.random.default_rng(SEED)

    train_df = pd.read_csv(TRAIN_DATA_FILE)
    test_df = pd.read_csv(TEST_DATA_FILE, parse_dates=["Date"])

    city_encoder = LabelEncoder().fit(pd.concat([train_df["City"], test_df["City"]]))
    test_df["City_Encoded"] = city_encoder.transform(test_df["City"])
    label_encoder = LabelEncoder().fit(train_df["Flood_Risk"])
    class_names = [str(c) for c in label_encoder.classes_]

    model = joblib.load(BEST_MODEL_PATH)
    if not hasattr(model, "predict_proba"):
        raise RuntimeError(
            f"{type(model).__name__} has no predict_proba - PR-AUC needs class "
            "probabilities, not just hard predictions."
        )

    y_true = label_encoder.transform(test_df["Flood_Risk"])
    y_pred = model.predict(test_df[FEATURE_COLUMNS])
    y_proba = model.predict_proba(test_df[FEATURE_COLUMNS])

    y_true_bin = label_binarize(y_true, classes=range(len(class_names)))

    print("Test set class counts:")
    counts = pd.Series(y_true).map(dict(enumerate(class_names))).value_counts()
    print(counts.to_string())
    print()

    pr_auc = per_class_pr_auc(y_true_bin, y_proba, class_names)
    print("Per-class PR-AUC (average precision, one-vs-rest):")
    for name, val in pr_auc.items():
        print(f"  {name:10s} {val:.4f}")
    print()

    blocks = test_df["Date"].dt.to_period("M").astype(str).values

    print(f"Block-bootstrap 95% CI on recall ({RESAMPLES} resamples, block = calendar month):")
    recall_ci = {}
    for class_name in FOCUS_CLASSES:
        class_idx = list(label_encoder.classes_).index(class_name)
        point_recall = recall_score(y_true, y_pred, labels=[class_idx], average="micro", zero_division=0)
        scores = block_bootstrap_recall(y_true, y_pred, blocks, class_idx, RESAMPLES, rng)
        lo, hi = ci(scores)
        n_class = int((y_true == class_idx).sum())
        print(f"  {class_name:10s} n={n_class:4d}  recall={point_recall:.4f}  "
              f"95% CI [{lo:.4f}, {hi:.4f}]  (from {len(scores)}/{RESAMPLES} valid resamples)")
        recall_ci[class_name] = {
            "n_test_rows": n_class,
            "point_recall": round(float(point_recall), 4),
            "ci_95": [round(lo, 4), round(hi, 4)],
            "valid_resamples": len(scores),
        }

    payload = {
        "model": type(model).__name__,
        "resamples": RESAMPLES,
        "block_unit": "calendar month",
        "seed": SEED,
        "pr_auc_per_class": pr_auc,
        "recall_ci_high_extreme": recall_ci,
        "test_class_counts": counts.to_dict(),
    }
    with open(RESULTS_JSON, "w") as f:
        json.dump(payload, f, indent=2)
    logger.info(f"Saved -> {RESULTS_JSON}")
    print(f"\nSaved -> {RESULTS_JSON}")


if __name__ == "__main__":
    main()
