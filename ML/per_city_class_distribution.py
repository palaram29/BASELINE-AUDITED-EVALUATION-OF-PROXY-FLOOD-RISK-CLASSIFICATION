"""
Per-city class distribution check (supervisor review, 9 Sep).

Global percentile thresholds are fit once on pooled training RiskScore
across all 30 cities. Since Vulnerability is static per city, a
low-vulnerability city could in principle never cross the High/Extreme
thresholds regardless of rainfall, meaning the global threshold design
silently makes some cities structurally incapable of ever being flagged
High or Extreme. This script checks the full dataset directly rather
than assuming either way.

Read-only against ML/data/processed_dataset.csv. Writes its own results
file only.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd

from ML.utils import PROCESSED_DATASET_CSV, REPORTS_DIR

RESULTS_CSV = os.path.join(REPORTS_DIR, "per_city_class_distribution.csv")


def main():
    df = pd.read_csv(PROCESSED_DATASET_CSV)

    counts = df.groupby(["City", "Flood_Risk"]).size().unstack(fill_value=0)
    for c in ["Low", "Medium", "High", "Extreme"]:
        if c not in counts.columns:
            counts[c] = 0
    counts = counts[["Low", "Medium", "High", "Extreme"]]

    counts["Total"] = counts.sum(axis=1)
    counts["Pct_High_Or_Extreme"] = ((counts["High"] + counts["Extreme"]) / counts["Total"] * 100).round(3)

    counts = counts.sort_values("Pct_High_Or_Extreme")
    counts.to_csv(RESULTS_CSV)

    print("===== PER-CITY FLOOD_RISK DISTRIBUTION =====\n")
    print(counts.to_string())

    zero_high = counts[(counts["High"] == 0)]
    zero_extreme = counts[(counts["Extreme"] == 0)]

    print(f"\nCities with ZERO High-risk rows in the full record: {len(zero_high)} of {len(counts)}")
    if len(zero_high):
        print(f"  {list(zero_high.index)}")
    print(f"Cities with ZERO Extreme-risk rows in the full record: {len(zero_extreme)} of {len(counts)}")
    if len(zero_extreme):
        print(f"  {list(zero_extreme.index)}")

    print(f"\nSaved -> {RESULTS_CSV}")


if __name__ == "__main__":
    main()
