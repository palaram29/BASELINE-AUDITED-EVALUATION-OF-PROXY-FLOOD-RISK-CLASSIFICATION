"""
Mandatory secondary robustness check (per the approved methodology):
walk-forward (rolling-origin) validation across 6 year-boundaries, each
fold repeating the FULL pipeline (rainfall normalization, Hazard/
Vulnerability, GLOBAL percentile thresholds, t->t+1 pairing) fit fresh on
that fold's own training period only - no fold ever sees a later year's
data during fitting.

Folds (matching the approved plan):
    Train 2010-2016 -> Test 2017
    Train 2010-2017 -> Test 2018
    Train 2010-2018 -> Test 2019
    Train 2010-2019 -> Test 2020
    Train 2010-2020 -> Test 2021
    Train 2010-2021 -> Test 2022

Results (all 3 models + all 3 baselines, per fold) are saved to
ML/reports/walkforward_results.csv - never fabricated or estimated.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

from ML.utils import logger, ensure_dirs, WALKFORWARD_RESULTS_CSV, FEATURE_COLUMNS
from ML.prepare_dataset import (
    load_raw,
    attach_geography,
    assign_period,
    compute_hazard,
    compute_vulnerability,
    compute_risk_score_and_labels,
    build_t_plus_1_pairs,
)
from ML.model_selector import get_model_registry
from ML.evaluate_models import evaluate_model
from ML.baselines import compute_all_baselines

FOLDS = [
    (2016, 2017),
    (2017, 2018),
    (2018, 2019),
    (2019, 2020),
    (2020, 2021),
    (2021, 2022),
]


def run_fold(df_raw, train_year_end, test_year):
    df = assign_period(df_raw, train_year_end=train_year_end, test_year_start=test_year)
    # Walk-forward test period is a single year, not "test_year onward" -
    # anything after test_year must be excluded from this fold entirely.
    df.loc[df["Year"] > test_year, "Period"] = "excluded"

    df, _ = compute_hazard(df)
    df, _ = compute_vulnerability(df)
    df, thresholds = compute_risk_score_and_labels(df)

    pairs = build_t_plus_1_pairs(df)
    train_df = pairs[pairs["Period"] == "train"].drop(columns=["Period"])
    test_df = pairs[pairs["Period"] == "test"].drop(columns=["Period"])

    if train_df.empty or test_df.empty:
        logger.warning(f"Fold train<={train_year_end}/test={test_year}: empty split, skipping")
        return None

    city_encoder = LabelEncoder()
    all_cities = pd.concat([train_df["City"], test_df["City"]], ignore_index=True)
    city_encoder.fit(all_cities)
    train_df = train_df.copy()
    test_df = test_df.copy()
    train_df["City_Encoded"] = city_encoder.transform(train_df["City"])
    test_df["City_Encoded"] = city_encoder.transform(test_df["City"])

    label_encoder = LabelEncoder()
    # Fit on both so a class that only appears in test (or only in train)
    # within a single fold doesn't crash the encoder - still evaluated
    # correctly via zero_division=0 in the metrics.
    label_encoder.fit(pd.concat([train_df["Flood_Risk"], test_df["Flood_Risk"]], ignore_index=True))

    X_train = train_df[FEATURE_COLUMNS]
    X_test = test_df[FEATURE_COLUMNS]
    y_train = label_encoder.transform(train_df["Flood_Risk"])
    y_test = label_encoder.transform(test_df["Flood_Risk"])
    labels = [str(c) for c in label_encoder.classes_]

    fold_results = []

    for model_name, build_model in get_model_registry().items():
        try:
            model = build_model()
            result = evaluate_model(model, model_name, X_train, X_test, y_train, y_test, label_encoder)
            fold_results.append(result)
        except Exception as exc:
            logger.error(f"Fold train<={train_year_end}/test={test_year}: {model_name} failed: {exc}")

    fold_results += compute_all_baselines(train_df, test_df, labels)

    for r in fold_results:
        r["train_year_end"] = train_year_end
        r["test_year"] = test_year
        r["train_rows"] = len(train_df)
        r["test_rows"] = len(test_df)

    return fold_results


def main():
    ensure_dirs()
    df_raw = attach_geography(load_raw())

    all_rows = []
    for train_year_end, test_year in FOLDS:
        logger.info(f"Walk-forward fold: train<={train_year_end}, test={test_year}")
        fold_results = run_fold(df_raw, train_year_end, test_year)
        if not fold_results:
            continue
        for r in fold_results:
            all_rows.append({
                "Train_Through_Year": r["train_year_end"],
                "Test_Year": r["test_year"],
                "Model": r["name"],
                "Train_Rows": r["train_rows"],
                "Test_Rows": r["test_rows"],
                "Accuracy": r["accuracy"],
                "Macro_F1": r["macro_f1"],
                "Macro_Precision": r["macro_precision"],
                "Macro_Recall": r["macro_recall"],
                "Weighted_F1": r["f1_score"],
                "High_Recall": r["high_risk_recall"],
                "Extreme_Recall": r["extreme_risk_recall"],
                "ROC_AUC": r["roc_auc"],
            })

    results_df = pd.DataFrame(all_rows)
    results_df.to_csv(WALKFORWARD_RESULTS_CSV, index=False)
    logger.info(f"Saved walk-forward results ({len(results_df)} rows) -> {WALKFORWARD_RESULTS_CSV}")

    print("\n===== WALK-FORWARD VALIDATION RESULTS =====\n")
    print(results_df.to_string(index=False))

    print("\n===== MEAN ACROSS FOLDS (per model) =====\n")
    summary = results_df.groupby("Model")[["Accuracy", "Macro_F1", "High_Recall", "Extreme_Recall"]].mean()
    print(summary.round(4).to_string())


if __name__ == "__main__":
    main()
