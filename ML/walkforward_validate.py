"""
Walk-forward (rolling-origin) validation across 6 year-boundaries.

Supervisor review (9 Sep) flagged a real internal-validity gap in the
previous version of this script: it reused the single hyperparameter
configuration selected once from the PRIMARY split's validation period
(2018-2019) across every fold, including folds testing on 2017, 2018 and
2019 - years at or before that configuration's own selection window. The
reviewer's rule: "if hyperparameters were frozen once, the freezing point
must precede every evaluation fold." That did not hold for three of the
six folds.

This version fixes it properly rather than caveating it: EVERY fold now
carves its own inner-train / inner-validation split out of ONLY that
fold's own training window, runs the same small grid search
tune_hyperparameters.py uses on the primary split, and selects that
fold's own hyperparameters before ever touching that fold's test year.
No fold's hyperparameter choice can be influenced by a year at or after
its own test year.

Folds (unchanged from before - only the tuning inside each fold changed):
    Train 2010-2016 -> inner-train 2010-2014, inner-val 2015-2016 -> Test 2017
    Train 2010-2017 -> inner-train 2010-2015, inner-val 2016-2017 -> Test 2018
    Train 2010-2018 -> inner-train 2010-2016, inner-val 2017-2018 -> Test 2019
    Train 2010-2019 -> inner-train 2010-2017, inner-val 2018-2019 -> Test 2020
    Train 2010-2020 -> inner-train 2010-2018, inner-val 2019-2020 -> Test 2021
    Train 2010-2021 -> inner-train 2010-2019, inner-val 2020-2021 -> Test 2022

Each fold's winning configuration is saved to
ML/reports/walkforward_hyperparameters.csv for reproducibility (the
review specifically asked for the winning configuration per fold, not
just "six candidate configurations").

Results (all 3 tuned models + all baselines, per fold) are saved to
ML/reports/walkforward_results.csv - never fabricated or estimated.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import f1_score
from sklearn.utils.class_weight import compute_sample_weight

from ML.utils import logger, ensure_dirs, REPORTS_DIR, WALKFORWARD_RESULTS_CSV, FEATURE_COLUMNS
from ML.prepare_dataset import (
    load_raw,
    attach_geography,
    attach_reliability_features,
    assign_period,
    compute_hazard,
    compute_vulnerability,
    compute_risk_score_and_labels,
    build_t_plus_1_pairs,
)
from ML.tune_hyperparameters import SEARCH_SPACE, build
from ML.evaluate_models import evaluate_model
from ML.baselines import compute_all_baselines

WALKFORWARD_HYPERPARAMS_CSV = os.path.join(REPORTS_DIR, "walkforward_hyperparameters.csv")

FOLDS = [
    (2016, 2017),
    (2017, 2018),
    (2018, 2019),
    (2019, 2020),
    (2020, 2021),
    (2021, 2022),
]


def tune_within_fold(train_df, label_encoder, fold_train_year_end):
    """Nested tuning using ONLY this fold's own training window. Inner
    validation is the last 2 calendar years of that window (mirroring the
    primary split's 2-year 2018-2019 validation period); inner-train is
    everything before that. Returns {model_name: best_params} and a list
    of every candidate's score for the reproducibility CSV."""

    inner_val_start_year = fold_train_year_end - 1  # last 2 years = validation
    inner = train_df[train_df["Date"].dt.year < inner_val_start_year]
    val = train_df[train_df["Date"].dt.year >= inner_val_start_year]

    if inner.empty or val.empty:
        logger.warning(
            f"Fold train<={fold_train_year_end}: inner-train or inner-val empty "
            f"(inner={len(inner)}, val={len(val)}) - falling back to single-candidate default"
        )
        return None, []

    X_inner = inner[FEATURE_COLUMNS]
    y_inner = label_encoder.transform(inner["Flood_Risk"])
    X_val = val[FEATURE_COLUMNS]
    y_val = label_encoder.transform(val["Flood_Risk"])

    best_params_per_model = {}
    search_rows = []

    for name, candidates in SEARCH_SPACE.items():
        best_score, best_params = -1.0, candidates[0]

        for params in candidates:
            model = build(name, params)
            fit_kwargs = {}
            if name == "XGBoost":
                fit_kwargs["sample_weight"] = compute_sample_weight("balanced", y_inner)

            model.fit(X_inner, y_inner, **fit_kwargs)
            score = f1_score(y_val, model.predict(X_val), average="macro")

            search_rows.append({
                "train_year_end": fold_train_year_end,
                "model": name,
                "params": str(params),
                "inner_val_macro_f1": round(score, 4),
            })

            if score > best_score:
                best_score, best_params = score, params

        best_params_per_model[name] = best_params
        logger.info(
            f"Fold train<={fold_train_year_end}: {name} selected {best_params} "
            f"(inner-val macro-F1 {best_score:.4f})"
        )

    for row in search_rows:
        row["selected"] = str(row["params"]) == str(best_params_per_model[row["model"]])

    return best_params_per_model, search_rows


def run_fold(df_raw, train_year_end, test_year):
    df = assign_period(df_raw, train_year_end=train_year_end, test_year_start=test_year)
    df.loc[df["Year"] > test_year, "Period"] = "excluded"

    df, _ = compute_hazard(df)
    df, _ = compute_vulnerability(df)
    df, thresholds = compute_risk_score_and_labels(df)

    pairs = build_t_plus_1_pairs(df)
    train_df = pairs[pairs["Period"] == "train"].drop(columns=["Period"])
    test_df = pairs[pairs["Period"] == "test"].drop(columns=["Period"])

    if train_df.empty or test_df.empty:
        logger.warning(f"Fold train<={train_year_end}/test={test_year}: empty split, skipping")
        return None, []

    city_encoder = LabelEncoder()
    all_cities = pd.concat([train_df["City"], test_df["City"]], ignore_index=True)
    city_encoder.fit(all_cities)
    train_df = train_df.copy()
    test_df = test_df.copy()
    train_df["City_Encoded"] = city_encoder.transform(train_df["City"])
    test_df["City_Encoded"] = city_encoder.transform(test_df["City"])

    label_encoder = LabelEncoder()
    label_encoder.fit(pd.concat([train_df["Flood_Risk"], test_df["Flood_Risk"]], ignore_index=True))

    # Nested tuning: this fold's hyperparameters come ONLY from this
    # fold's own training window, chosen before this fold's test year is
    # ever touched - the fix for the leakage the review identified.
    best_params_per_model, search_rows = tune_within_fold(train_df, label_encoder, train_year_end)

    X_train = train_df[FEATURE_COLUMNS]
    X_test = test_df[FEATURE_COLUMNS]
    y_train = label_encoder.transform(train_df["Flood_Risk"])
    y_test = label_encoder.transform(test_df["Flood_Risk"])
    labels = [str(c) for c in label_encoder.classes_]

    fold_results = []

    for model_name, candidates in SEARCH_SPACE.items():
        try:
            params = (
                best_params_per_model[model_name]
                if best_params_per_model is not None
                else candidates[0]
            )
            model = build(model_name, params)
            result = evaluate_model(model, model_name, X_train, X_test, y_train, y_test, label_encoder)
            result["selected_params"] = str(params)
            fold_results.append(result)
        except Exception as exc:
            logger.error(f"Fold train<={train_year_end}/test={test_year}: {model_name} failed: {exc}")

    fold_results += compute_all_baselines(train_df, test_df, labels)

    for r in fold_results:
        r["train_year_end"] = train_year_end
        r["test_year"] = test_year
        r["train_rows"] = len(train_df)
        r["test_rows"] = len(test_df)

    return fold_results, search_rows


def main():
    ensure_dirs()
    df_raw = attach_reliability_features(attach_geography(load_raw()))

    all_rows = []
    all_search_rows = []
    for train_year_end, test_year in FOLDS:
        logger.info(f"Walk-forward fold: train<={train_year_end}, test={test_year} (nested tuning)")
        fold_results, search_rows = run_fold(df_raw, train_year_end, test_year)
        all_search_rows.extend(search_rows)
        if not fold_results:
            continue
        for r in fold_results:
            all_rows.append({
                "Train_Through_Year": r["train_year_end"],
                "Test_Year": r["test_year"],
                "Model": r["name"],
                "Selected_Params": r.get("selected_params", ""),
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

    search_df = pd.DataFrame(all_search_rows)
    search_df.to_csv(WALKFORWARD_HYPERPARAMS_CSV, index=False)
    logger.info(f"Saved per-fold hyperparameter search -> {WALKFORWARD_HYPERPARAMS_CSV}")

    print("\n===== WALK-FORWARD VALIDATION RESULTS (nested per-fold tuning) =====\n")
    print(results_df.to_string(index=False))

    print("\n===== SELECTED HYPERPARAMETERS PER FOLD =====\n")
    selected = results_df[results_df["Selected_Params"] != ""][
        ["Train_Through_Year", "Model", "Selected_Params"]
    ].drop_duplicates()
    print(selected.to_string(index=False))

    print("\n===== MEAN ACROSS FOLDS (per model) =====\n")
    summary = results_df.groupby("Model")[["Accuracy", "Macro_F1", "High_Recall", "Extreme_Recall"]].mean()
    print(summary.round(4).to_string())

    print("\n===== PER-FOLD MACRO-F1 RANKING =====\n")
    for test_year, g in results_df.groupby("Test_Year"):
        ranked = g.sort_values("Macro_F1", ascending=False)
        top = ranked.iloc[0]
        print(f"Test {test_year}: 1st = {top['Model']} ({top['Macro_F1']:.4f})  |  "
              + ", ".join(f"{r.Model} {r.Macro_F1:.4f}" for r in ranked.itertuples()))

    wins = results_df.loc[results_df.groupby("Test_Year")["Macro_F1"].idxmax(), "Model"]
    print(f"\nPersistence ranked first in {(wins == 'Persistence').sum()} of {len(wins)} folds.")


if __name__ == "__main__":
    main()
