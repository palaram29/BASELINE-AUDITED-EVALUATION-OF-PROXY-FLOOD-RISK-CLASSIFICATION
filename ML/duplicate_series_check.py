"""
Duplicate-series robustness check (supervisor review, Priority 3).

Question: does "persistence beats every trained model" still hold once
the sample isn't 30 nominal cities but the 15 distinct rainfall series
underlying them (see ML/data/processed_dataset.csv analysis: 7 cities
share one identical rainfall record, another 7 share a second, 3 share
a third, 2 share a fourth - 19 of 30 "cities" are exact duplicates of
15 independent series)? If the headline result only holds because
duplicate cities inflate the effective sample size, restricting
evaluation to one representative per series should visibly change the
outcome (wider intervals, weaker/reversed margin). If the result is
genuinely robust, it should look essentially the same.

Two checks, both against the SAME frozen production model
(ML/model_selector.py's selected RandomForest) and the SAME
test_dataset.csv used for the paper's primary result - no retraining:

  1. Filtered evaluation: score persistence and the frozen model only
     on the test rows for the 15 independent representative cities
     (one per duplicate group, plus all 11 singleton cities), then
     compare macro-F1 to the full 30-city result.
  2. Cluster-aware block bootstrap: same paired block bootstrap as
     ML/compute_statistics.py, but blocks are (rainfall-series-group,
     calendar-month) instead of plain calendar-month, so duplicate
     cities can never be resampled as if they were independent
     evidence within a single draw.

Does not retrain any model and does not modify train_dataset.csv,
test_dataset.csv, or the frozen production model. Writes its own
results file only.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import f1_score

from backend.config import TRAIN_DATA_FILE, TEST_DATA_FILE
from ML.utils import REPORTS_DIR, BEST_MODEL_PATH, FEATURE_COLUMNS

RESULTS_CSV = os.path.join(REPORTS_DIR, "duplicate_series_results.csv")
SEED = 42
RESAMPLES = 2000
PERSISTENCE_COLUMN = "Flood_Risk_Previous_Day"

# Series group -> representative city (one per group of exact-duplicate
# rainfall records). Any city not listed here is already a singleton
# (its own independent series) and is included as-is.
DUPLICATE_GROUPS = {
    "A": ["Athurugiriya", "Gampaha", "Kolonnawa", "Mabole", "Negombo", "Oruwala", "Sri Jayewardenepura Kotte"],
    "B": ["Bentota", "Colombo", "Kalutara", "Kesbewa", "Maharagama", "Moratuwa", "Mount Lavinia"],
    "C": ["Galle", "Matara", "Weligama"],
    "D": ["Kurunegala", "Pothuhera"],
}
REPRESENTATIVE = {"A": "Negombo", "B": "Colombo", "C": "Galle", "D": "Kurunegala"}

CITY_TO_GROUP = {city: g for g, cities in DUPLICATE_GROUPS.items() for city in cities}


def independent_city_list(all_cities):
    """11 singleton cities + 1 representative per duplicate group = 15."""
    grouped = set(CITY_TO_GROUP)
    singles = sorted(set(all_cities) - grouped)
    reps = sorted(REPRESENTATIVE.values())
    return sorted(singles + reps)


def series_group_id(city):
    """Cluster id for the bootstrap: duplicate group letter, or the
    city's own name if it's an independent singleton."""
    return CITY_TO_GROUP.get(city, city)


def block_bootstrap_clustered(y_true, pred_a, pred_b, blocks, resamples, rng):
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


def macro_f1_on(test_df, y_true, y_model, y_persist, mask, label):
    idx = np.where(mask)[0]
    model_f1 = f1_score(y_true[idx], y_model[idx], average="macro", zero_division=0)
    persist_f1 = f1_score(y_true[idx], y_persist[idx], average="macro", zero_division=0)
    print(f"  [{label}] n={len(idx)}  Persistence={persist_f1:.4f}  RF={model_f1:.4f}  "
          f"margin={persist_f1 - model_f1:+.4f}  Persistence wins: {persist_f1 > model_f1}")
    return {
        "Check": label,
        "N_Rows": len(idx),
        "Persistence_Macro_F1": round(persist_f1, 4),
        "RF_Macro_F1": round(model_f1, 4),
        "Persistence_Margin": round(persist_f1 - model_f1, 4),
        "Persistence_Wins": persist_f1 > model_f1,
    }


def main():
    rng = np.random.default_rng(SEED)

    train_df = pd.read_csv(TRAIN_DATA_FILE)
    test_df = pd.read_csv(TEST_DATA_FILE, parse_dates=["Date"])

    all_cities = sorted(set(train_df["City"]).union(test_df["City"]))
    independent_cities = independent_city_list(all_cities)
    print(f"{len(all_cities)} nominal cities -> {len(independent_cities)} independent series")
    print(f"Independent city list: {independent_cities}\n")

    city_encoder = LabelEncoder().fit(pd.concat([train_df["City"], test_df["City"]]))
    test_df["City_Encoded"] = city_encoder.transform(test_df["City"])
    label_encoder = LabelEncoder().fit(train_df["Flood_Risk"])

    model = joblib.load(BEST_MODEL_PATH)

    y_true = label_encoder.transform(test_df["Flood_Risk"])
    y_model = model.predict(test_df[FEATURE_COLUMNS])
    y_persist = label_encoder.transform(test_df[PERSISTENCE_COLUMN])

    results = []

    # Check 1: full 30-city baseline (for direct side-by-side reference)
    print("Check 1 - filtered evaluation:")
    full_mask = np.ones(len(test_df), dtype=bool)
    results.append(macro_f1_on(test_df, y_true, y_model, y_persist, full_mask, "All 30 cities (reference)"))

    independent_mask = test_df["City"].isin(independent_cities).values
    results.append(macro_f1_on(test_df, y_true, y_model, y_persist, independent_mask, "15 independent series only"))

    # Check 2: cluster-aware block bootstrap on the FULL test set, blocking
    # by (series group, month) so duplicate cities can't be drawn as if
    # they were independent evidence.
    print("\nCheck 2 - cluster-aware block bootstrap (full test set, 2000 resamples):")
    series_group = test_df["City"].map(series_group_id)
    blocks = series_group.astype(str) + "_" + test_df["Date"].dt.to_period("M").astype(str)
    blocks = blocks.values

    model_scores, persist_scores, deltas = block_bootstrap_clustered(
        y_true, y_model, y_persist, blocks, RESAMPLES, rng
    )
    model_lo, model_hi = ci(model_scores)
    persist_lo, persist_hi = ci(persist_scores)
    delta_lo, delta_hi = ci(deltas)
    persist_win_rate = float((deltas < 0).mean())  # delta = model - persist

    print(f"  Persistence macro-F1: {y_persist is not None and f1_score(y_true, y_persist, average='macro'):.4f} "
          f"[{persist_lo:.4f}, {persist_hi:.4f}]")
    print(f"  RF macro-F1:          {f1_score(y_true, y_model, average='macro'):.4f} "
          f"[{model_lo:.4f}, {model_hi:.4f}]")
    print(f"  Delta (RF - Persistence) 95% CI: [{delta_lo:.4f}, {delta_hi:.4f}]")
    print(f"  Persistence wins in {persist_win_rate*100:.1f}% of cluster-aware resamples")

    results.append({
        "Check": "Cluster-aware block bootstrap (RF - Persistence delta)",
        "N_Rows": len(test_df),
        "Persistence_Macro_F1": round(f1_score(y_true, y_persist, average="macro"), 4),
        "RF_Macro_F1": round(f1_score(y_true, y_model, average="macro"), 4),
        "Delta_CI_Low": round(delta_lo, 4),
        "Delta_CI_High": round(delta_hi, 4),
        "Persistence_Win_Rate_Pct": round(persist_win_rate * 100, 2),
    })

    out = pd.DataFrame(results)
    out.to_csv(RESULTS_CSV, index=False)
    print(f"\nSaved -> {RESULTS_CSV}")


if __name__ == "__main__":
    main()
