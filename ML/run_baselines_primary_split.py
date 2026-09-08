"""
Runs all baselines (Majority, Persistence, Seasonal, Markov) on the SAME
primary chronological train/test split used for the paper's headline
Table III comparison (ML/data/train_dataset.csv / test_dataset.csv) -
as opposed to ML/walkforward_validate.py, which is the only place
compute_all_baselines was previously wired in, and which reruns
baselines separately inside each of the six walk-forward folds.

Usage:
    python ML/run_baselines_primary_split.py
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd

from ML.utils import REPORTS_DIR
from ML.baselines import compute_all_baselines

RESULTS_CSV = os.path.join(REPORTS_DIR, "baseline_comparison_primary_split.csv")
LABEL_ORDER = ["Low", "Medium", "High", "Extreme"]


def main():
    train_df = pd.read_csv("ML/data/train_dataset.csv")
    test_df = pd.read_csv("ML/data/test_dataset.csv")

    labels = [l for l in LABEL_ORDER if l in set(train_df["Flood_Risk"]).union(test_df["Flood_Risk"])]

    results = compute_all_baselines(train_df, test_df, labels)

    table = pd.DataFrame([{
        "Baseline": r["name"],
        "Macro_F1": round(r["macro_f1"], 4),
        "Weighted_F1": round(r["f1_score"], 4),
        "Accuracy": round(r["accuracy"], 4),
        "High_Recall": round(r["high_risk_recall"], 4),
        "Extreme_Recall": round(r["extreme_risk_recall"], 4),
    } for r in results])

    print("===== BASELINE COMPARISON (primary split) =====")
    print(table.to_string(index=False))

    table.to_csv(RESULTS_CSV, index=False)
    print(f"\nSaved -> {RESULTS_CSV}")


if __name__ == "__main__":
    main()
