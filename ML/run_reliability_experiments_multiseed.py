"""
Multi-seed reliability degradation diagnostic (supervisor review, 9 Sep).

ML/run_reliability_experiments.py runs each degradation condition under
ONE random draw of which rows get corrupted (random_state=42 throughout).
The resulting Fig. 2 line is therefore a single deterministic run, not an
estimate with any notion of spread - the review asked for genuine
run-to-run variance, not a repeated identical number.

This script reruns the exact same condition x feature-set x model grid
under N different random seeds (only the DEGRADATION DRAW changes per
seed - which specific rows get corrupted; model hyperparameters stay
frozen and training data is unchanged, since the reliability question is
about degradation exposure, not retraining variance), then reports
mean +/- standard deviation of macro-F1 across seeds for every condition,
and regenerates Fig. 2 with error bars instead of a single line.

Reuses ML/run_reliability_experiments.py's _apply_condition,
_recompute_reliability_features, FEATURE_SETS and CONDITIONS directly,
rather than reimplementing the degradation/scoring logic - only the
outer seed loop and aggregation are new. Writes its own results files
and figure; does not overwrite ML/reports/reliability_experiments/
comparison_table.csv (the original single-seed run).

Usage:
    python ML/run_reliability_experiments_multiseed.py --seeds 10
"""

import os
import sys
import argparse

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.preprocessing import LabelEncoder

from backend.config import TRAIN_DATA_FILE, TEST_DATA_FILE
from ML.utils import logger, ensure_dirs, REPORTS_DIR
from ML.model_selector import get_model_registry
from ML.evaluate_models import evaluate_model
from ML.run_reliability_experiments import (
    CONDITIONS,
    FEATURE_SETS,
    _apply_condition,
    _recompute_reliability_features,
)

MULTISEED_DIR = os.path.join(REPORTS_DIR, "reliability_experiments_multiseed")
RESULTS_CSV = os.path.join(MULTISEED_DIR, "multiseed_results.csv")
AGGREGATE_CSV = os.path.join(MULTISEED_DIR, "multiseed_aggregate.csv")
FIGURE_PATH = os.path.join(MULTISEED_DIR, "figure2_multiseed_error_bars.png")


def run_one_seed(seed, train_df, test_df_original, city_encoder, label_encoder, y_train):
    rows = []
    for condition_name, condition in CONDITIONS.items():
        degraded_test_df, delay_column = _apply_condition(test_df_original, condition, random_state=seed)
        degraded_test_df = _recompute_reliability_features(degraded_test_df, delay_column)
        degraded_test_df["City_Encoded"] = city_encoder.transform(degraded_test_df["City"])
        y_test = label_encoder.transform(degraded_test_df["Flood_Risk"])

        for config_name, feature_columns in FEATURE_SETS.items():
            X_train = train_df[feature_columns]
            X_test = degraded_test_df[feature_columns]
            medians = X_train.median(numeric_only=True)
            X_test_imputed = X_test.fillna(medians)

            for model_name, build_model in get_model_registry().items():
                model = build_model()
                result = evaluate_model(
                    model, model_name, X_train, X_test_imputed, y_train, y_test, label_encoder
                )
                rows.append({
                    "seed": seed,
                    "condition": condition_name,
                    "feature_set": config_name,
                    "model": model_name,
                    "macro_f1": result["macro_f1"],
                })
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seeds", type=int, default=10, help="Number of random seeds to run (default 10)")
    args = parser.parse_args()

    ensure_dirs()
    os.makedirs(MULTISEED_DIR, exist_ok=True)

    train_df = pd.read_csv(TRAIN_DATA_FILE)
    test_df_original = pd.read_csv(TEST_DATA_FILE)

    city_encoder = LabelEncoder().fit(pd.concat([train_df["City"], test_df_original["City"]], ignore_index=True))
    train_df = train_df.copy()
    train_df["City_Encoded"] = city_encoder.transform(train_df["City"])

    label_encoder = LabelEncoder()
    y_train = label_encoder.fit_transform(train_df["Flood_Risk"])

    seeds = list(range(1, args.seeds + 1))
    all_rows = []
    for seed in seeds:
        logger.info(f"Multi-seed reliability diagnostic: seed {seed}/{len(seeds)}")
        all_rows.extend(run_one_seed(seed, train_df, test_df_original, city_encoder, label_encoder, y_train))
        print(f"Completed seed {seed}/{len(seeds)}")

    results_df = pd.DataFrame(all_rows)
    results_df.to_csv(RESULTS_CSV, index=False)
    logger.info(f"Saved per-seed results -> {RESULTS_CSV}")

    agg = (
        results_df.groupby(["condition", "feature_set", "model"])["macro_f1"]
        .agg(["mean", "std", "count"])
        .reset_index()
    )
    agg.to_csv(AGGREGATE_CSV, index=False)
    logger.info(f"Saved aggregated mean/std -> {AGGREGATE_CSV}")

    print(f"\n===== MEAN +/- STD MACRO-F1 ACROSS {len(seeds)} SEEDS =====\n")
    print(agg.round(4).to_string(index=False))

    # --- Regenerate Figure 2 with error bars ---
    condition_order = list(CONDITIONS.keys())
    models = sorted(results_df["model"].unique())

    fig, axes = plt.subplots(1, len(models), figsize=(5 * len(models), 4), sharey=True)
    if len(models) == 1:
        axes = [axes]

    for ax, model_name in zip(axes, models):
        for feature_set, style in [("baseline", dict(color="black", marker="o", linestyle="-")),
                                    ("reliability_aware", dict(color="gray", marker="s", linestyle="--"))]:
            sub = agg[(agg["model"] == model_name) & (agg["feature_set"] == feature_set)]
            sub = sub.set_index("condition").reindex(condition_order)
            ax.errorbar(
                condition_order, sub["mean"], yerr=sub["std"],
                capsize=3, label=feature_set.replace("_", " "), **style,
            )
        ax.set_title(model_name)
        ax.set_xticks(range(len(condition_order)))
        ax.set_xticklabels(condition_order, rotation=45, ha="right")
        ax.set_ylabel("Macro-F1")
        ax.legend()

    fig.suptitle(f"Macro-F1 across degradation conditions, mean +/- std over {len(seeds)} seeds")
    fig.tight_layout()
    fig.savefig(FIGURE_PATH, dpi=200)
    print(f"\nSaved updated Figure 2 (with error bars) -> {FIGURE_PATH}")


if __name__ == "__main__":
    main()
