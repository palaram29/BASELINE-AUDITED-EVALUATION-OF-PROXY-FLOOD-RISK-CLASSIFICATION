"""
Baselines the trained models must beat to demonstrate genuine forecasting
value, per docs/ML_METHODOLOGY_AND_LIMITATIONS.md. All three are computed
using ONLY information available at prediction time - none of them peek
at test-period labels or features to build themselves.

- Majority:   always predict the single most common class in y_train.
- Persistence: predict Flood_Risk(t+1) = Flood_Risk(t), i.e. the
  Flood_Risk_Previous_Day column already carried in train/test_dataset.csv
  (each row's OWN same-day derived label, computed by ML/prepare_dataset.py
  before the t+1 shift). Uses no environmental features at all.
- Seasonal: for each (City, calendar month) in TRAINING data, take the
  most common Flood_Risk. Applied to test rows by their own City/month.
  Uses only training-period label history - never a test-period label
  or environmental feature.
"""

import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix,
)

from ML.utils import logger


def _score(y_true, y_pred, labels):
    """Same metric set evaluate_models.evaluate_model produces, so
    baselines slot into the same comparison table as the trained models."""

    report = classification_report(
        y_true, y_pred, labels=labels, target_names=labels,
        output_dict=True, zero_division=0
    )

    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, average="weighted", zero_division=0),
        "recall": recall_score(y_true, y_pred, average="weighted", zero_division=0),
        "f1_score": f1_score(y_true, y_pred, average="weighted", zero_division=0),
        "macro_precision": precision_score(y_true, y_pred, average="macro", zero_division=0),
        "macro_recall": recall_score(y_true, y_pred, average="macro", zero_division=0),
        "macro_f1": f1_score(y_true, y_pred, average="macro", zero_division=0),
        "high_risk_recall": report.get("High", {}).get("recall", 0.0),
        "extreme_risk_recall": report.get("Extreme", {}).get("recall", 0.0),
        "roc_auc": None,
        "training_time": 0.0,
        "prediction_time": 0.0,
        "classification_report": report,
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=labels),
        "labels": labels,
        "feature_importance": {},
        "status": "Baseline",
    }


def majority_baseline(train_df, test_df, labels):
    majority_class = train_df["Flood_Risk"].mode()[0]
    y_pred = [majority_class] * len(test_df)

    logger.info(f"Majority baseline: always predicts '{majority_class}'")

    result = _score(test_df["Flood_Risk"], y_pred, labels)
    result["name"] = "MajorityBaseline"
    result["model"] = None
    return result


def persistence_baseline(test_df, labels):
    """Flood_Risk(t+1) = Flood_Risk(t). Uses only each test row's own
    Flood_Risk_Previous_Day column - no training data, no environmental
    features, no lookahead."""

    y_pred = test_df["Flood_Risk_Previous_Day"]

    result = _score(test_df["Flood_Risk"], y_pred, labels)
    result["name"] = "PersistenceBaseline"
    result["model"] = None
    return result


def seasonal_baseline(train_df, test_df, labels):
    """Most common Flood_Risk per (City, calendar month) in TRAINING data
    only, applied to test rows by their own City/month. A city/month
    combination absent from training falls back to the overall training
    majority class."""

    train_df = train_df.copy()
    train_df["Month"] = pd.to_datetime(train_df["Date"]).dt.month

    seasonal_mode = (
        train_df.groupby(["City", "Month"])["Flood_Risk"]
        .agg(lambda s: s.mode()[0])
    )
    overall_majority = train_df["Flood_Risk"].mode()[0]

    test_df = test_df.copy()
    test_df["Month"] = pd.to_datetime(test_df["Date"]).dt.month

    def lookup(row):
        return seasonal_mode.get((row["City"], row["Month"]), overall_majority)

    y_pred = test_df.apply(lookup, axis=1)

    logger.info(
        f"Seasonal baseline: {len(seasonal_mode)} (City, Month) combinations "
        f"learned from training data, {overall_majority} fallback for the rest"
    )

    result = _score(test_df["Flood_Risk"], y_pred, labels)
    result["name"] = "SeasonalBaseline"
    result["model"] = None
    return result


def compute_all_baselines(train_df, test_df, labels):
    return [
        majority_baseline(train_df, test_df, labels),
        persistence_baseline(test_df, labels),
        seasonal_baseline(train_df, test_df, labels),
    ]
