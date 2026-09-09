"""
Ordinal-aware evaluation and three additional baselines (supervisor
review, 9 Sep).

The four Flood_Risk classes are ordinal (Low < Medium < High < Extreme),
not nominal, so macro-F1 treats a Low-predicted-as-Extreme error
identically to a Low-predicted-as-Medium error even though the first is
far worse operationally. This script adds two ordinal-aware metrics
(linear-weighted Cohen's kappa, and mean absolute class-distance error)
for the main comparators, and adds three baselines the review asked for
that were missing from ML/baselines.py:

  - Rainfall-only rule: reclassifies Rainfall_3Day ALONE using global
    percentile thresholds fit on training Rainfall_3Day (mirrors the
    real label's percentile logic, but skips Vulnerability entirely) -
    a naive rule, not a trained model, so it tests whether Vulnerability
    contributes anything beyond a pure-rainfall threshold rule.
  - Ordinal logistic: a multinomial logistic regression on the full
    feature set. Not a true proportional-odds ordinal model (scikit-learn
    has no built-in one), so this is reported as a multinomial
    approximation, not a claim of genuine ordinal regression.
  - Lagged risk-score: logistic regression using ONLY today's continuous
    RiskScore(t) as a single numeric predictor of tomorrow's bucket -
    distinct from plain persistence, which just re-uses today's own
    BUCKET unchanged; this baseline can learn systematic drift the
    discrete persistence rule cannot.

Uses the frozen production Random Forest (best_model.pkl) for RF's own
ordinal metrics - does not retrain it. Rebuilds t->t+1 pairs with
RiskScore(t) carried forward, which ML/prepare_dataset.py's
build_t_plus_1_pairs does not currently do; this script does its own
pairing rather than modifying that shared function. Writes its own
results file only.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import cohen_kappa_score, f1_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.pipeline import make_pipeline

from ML.utils import logger, REPORTS_DIR, BEST_MODEL_PATH, FEATURE_COLUMNS
from ML.prepare_dataset import (
    load_raw,
    attach_geography,
    attach_reliability_features,
    assign_period,
    compute_hazard,
    compute_vulnerability,
    compute_risk_score_and_labels,
)

RESULTS_CSV = os.path.join(REPORTS_DIR, "ordinal_metrics_and_extended_baselines.csv")
CLASS_ORDER = ["Low", "Medium", "High", "Extreme"]
CLASS_INDEX = {c: i for i, c in enumerate(CLASS_ORDER)}


def build_pairs_with_riskscore(df):
    """Same t->t+1 pairing rules as build_t_plus_1_pairs (consecutive
    days only, no period-boundary crossing), but additionally carries
    RiskScore(t) forward for the lagged-risk-score baseline below."""

    df = df.sort_values(["City", "End_Date"]).reset_index(drop=True)
    pairs = []

    for city, g in df.groupby("City"):
        g = g.sort_values("End_Date").reset_index(drop=True)
        for i in range(len(g) - 1):
            row_t = g.iloc[i]
            row_t1 = g.iloc[i + 1]
            if (row_t1["End_Date"] - row_t["End_Date"]).days != 1:
                continue
            if row_t["Period"] != row_t1["Period"]:
                continue
            if row_t["Period"] not in ("train", "test"):
                continue

            pairs.append({
                "City": city,
                "Rainfall_3Day": row_t["Rainfall_3Day"],
                "Avg_Temperature": row_t["Avg_Temperature"],
                "Avg_WindSpeed": row_t["Avg_WindSpeed"],
                "Elevation": row_t["Elevation"],
                "Coastal_Flag": row_t["Coastal_Flag"],
                "RiskScore_At_T": row_t["RiskScore"],
                "Flood_Risk_Previous_Day": row_t["Flood_Risk"],
                "Flood_Risk": row_t1["Flood_Risk"],
                "Period": row_t["Period"],
            })

    return pd.DataFrame(pairs)


def rainfall_only_rule(train_df, test_df):
    """Global percentile thresholds fit on TRAINING Rainfall_3Day alone,
    same cut points (95/98.5/99.5) as the real label's default, applied
    with no Vulnerability term at all."""

    q95, q985, q995 = train_df["Rainfall_3Day"].quantile([0.95, 0.985, 0.995])

    def classify(r):
        if r >= q995:
            return "Extreme"
        if r >= q985:
            return "High"
        if r >= q95:
            return "Medium"
        return "Low"

    return test_df["Rainfall_3Day"].apply(classify)


def ordinal_metrics(y_true_labels, y_pred_labels, name):
    y_true_idx = y_true_labels.map(CLASS_INDEX).values
    y_pred_idx = pd.Series(y_pred_labels).map(CLASS_INDEX).values

    kappa = cohen_kappa_score(y_true_idx, y_pred_idx, weights="linear")
    class_distance_error = np.mean(np.abs(y_true_idx - y_pred_idx))
    macro_f1 = f1_score(y_true_idx, y_pred_idx, average="macro")

    print(f"{name:28s} macro-F1={macro_f1:.4f}  weighted-kappa={kappa:.4f}  "
          f"mean class-distance-error={class_distance_error:.4f}")

    return {
        "Comparator": name,
        "Macro_F1": round(macro_f1, 4),
        "Linear_Weighted_Kappa": round(float(kappa), 4),
        "Mean_Class_Distance_Error": round(float(class_distance_error), 4),
    }


def main():
    logger.info("Rebuilding pipeline with RiskScore carried through pairing...")
    df = attach_reliability_features(attach_geography(load_raw()))
    df = assign_period(df)
    df, _ = compute_hazard(df)
    df, _ = compute_vulnerability(df)
    df, thresholds = compute_risk_score_and_labels(df)

    pairs = build_pairs_with_riskscore(df)
    train_df = pairs[pairs["Period"] == "train"].drop(columns=["Period"])
    test_df = pairs[pairs["Period"] == "test"].drop(columns=["Period"])

    city_encoder = LabelEncoder().fit(pd.concat([train_df["City"], test_df["City"]]))
    train_df["City_Encoded"] = city_encoder.transform(train_df["City"])
    test_df["City_Encoded"] = city_encoder.transform(test_df["City"])

    results = []

    # --- Majority and persistence, for reference ---
    majority_class = train_df["Flood_Risk"].mode()[0]
    results.append(ordinal_metrics(test_df["Flood_Risk"], [majority_class] * len(test_df), "Majority"))
    results.append(ordinal_metrics(test_df["Flood_Risk"], test_df["Flood_Risk_Previous_Day"], "Persistence"))

    # --- Frozen production Random Forest ---
    label_encoder_rf = LabelEncoder().fit(train_df["Flood_Risk"])
    rf_model = joblib.load(BEST_MODEL_PATH)
    rf_pred_idx = rf_model.predict(test_df[FEATURE_COLUMNS])
    rf_pred_labels = label_encoder_rf.inverse_transform(rf_pred_idx)
    results.append(ordinal_metrics(test_df["Flood_Risk"], rf_pred_labels, "Random Forest (frozen)"))

    # --- New baseline 1: rainfall-only rule ---
    rainfall_only_pred = rainfall_only_rule(train_df, test_df)
    results.append(ordinal_metrics(test_df["Flood_Risk"], rainfall_only_pred, "Rainfall-only rule"))

    # --- New baseline 2: ordinal (multinomial) logistic regression ---
    label_encoder_lr = LabelEncoder().fit(train_df["Flood_Risk"])
    y_train_lr = label_encoder_lr.transform(train_df["Flood_Risk"])
    lr_model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, class_weight="balanced"))
    lr_model.fit(train_df[FEATURE_COLUMNS], y_train_lr)
    lr_pred_labels = label_encoder_lr.inverse_transform(lr_model.predict(test_df[FEATURE_COLUMNS]))
    results.append(ordinal_metrics(test_df["Flood_Risk"], lr_pred_labels, "Ordinal logistic (multinomial)"))

    # --- New baseline 3: lagged continuous risk-score ---
    label_encoder_lag = LabelEncoder().fit(train_df["Flood_Risk"])
    y_train_lag = label_encoder_lag.transform(train_df["Flood_Risk"])
    lag_model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, class_weight="balanced"))
    lag_model.fit(train_df[["RiskScore_At_T"]], y_train_lag)
    lag_pred_labels = label_encoder_lag.inverse_transform(lag_model.predict(test_df[["RiskScore_At_T"]]))
    results.append(ordinal_metrics(test_df["Flood_Risk"], lag_pred_labels, "Lagged risk-score (logistic)"))

    out = pd.DataFrame(results)
    out.to_csv(RESULTS_CSV, index=False)
    print(f"\nSaved -> {RESULTS_CSV}")


if __name__ == "__main__":
    main()
