"""
Build the t+1 flood-risk forecasting dataset from the raw historical
rainfall/temperature/wind records.

This replaces the old same-day, rainfall-threshold-derived Flood_Risk
label (which was recoverable from Rainfall_3Day alone - see
docs/ML_METHODOLOGY_AND_LIMITATIONS.md) with a next-day forecasting
target built from a documented Hazard x Vulnerability formula, using
GLOBAL percentile thresholds fit on the training period only.

Exact processing order (see docs/ML_METHODOLOGY_AND_LIMITATIONS.md for
the full methodology writeup and the review that produced it):

 1. Load raw historical data (ML/data/raw_historical_{train,test}.csv)
 2. Parse dates
 3. Combine into one historical pool (the original train/test split was
    an interleaved random split of overlapping windows, not usable here)
 4. Sort by City, End_Date
 5. Chronological train/test boundary: End_Date year <= TRAIN_YEARS_END
    is "training period", >= TEST_YEARS_START is "test period"
 6. Fit rainfall normalization (min/max) on TRAINING PERIOD Rainfall_3Day
 7. Compute Hazard(t) = normalized Rainfall_3Day(t), clipped to [0, 1]
 8. Compute Vulnerability(City) = 0.5*InverseElevation + 0.5*Coastal_Flag
    (elevation normalized+clipped to avoid an exact 0 vulnerability)
 9. Compute RiskScore(t) = Hazard(t) * Vulnerability(City)
10. Fit GLOBAL percentile thresholds on TRAINING PERIOD RiskScore only
11. Apply the same fixed thresholds to every row (train and test) to
    assign each row its own same-day Flood_Risk label
12. Build t -> t+1 pairs per city (shift the label back one day so a
    row's target is the FOLLOWING day's label; features stay at t)
13. Drop each city's final row (no t+1 available)
14. Drop the one pair per city whose t+1 crosses the train/test boundary
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd

from ML.utils import (
    logger,
    DATA_DIR,
    RAW_HISTORICAL_TRAIN_CSV,
    RAW_HISTORICAL_TEST_CSV,
    PROCESSED_DATASET_CSV,
    TRAIN_YEARS_END,
    TEST_YEARS_START,
    RISK_PERCENTILE_BOUNDARIES,
    ELEVATION_MAP,
    COASTAL_MAP,
)

TRAIN_OUT_CSV = os.path.join(DATA_DIR, "train_dataset.csv")
TEST_OUT_CSV = os.path.join(DATA_DIR, "test_dataset.csv")


def load_raw():
    """Step 1-2: load the raw historical CSVs and parse dates."""

    if not os.path.exists(RAW_HISTORICAL_TRAIN_CSV) or not os.path.exists(RAW_HISTORICAL_TEST_CSV):
        raise FileNotFoundError(
            "Raw historical files not found at "
            f"{RAW_HISTORICAL_TRAIN_CSV} / {RAW_HISTORICAL_TEST_CSV}. "
            "These are the original (pre-redesign) train/test CSVs, preserved "
            "before the t+1 pipeline overwrites ML/data/train_dataset.csv "
            "and test_dataset.csv."
        )

    train_raw = pd.read_csv(RAW_HISTORICAL_TRAIN_CSV)
    test_raw = pd.read_csv(RAW_HISTORICAL_TEST_CSV)

    df = pd.concat([train_raw, test_raw], ignore_index=True)
    df["Start_Date"] = pd.to_datetime(df["Start_Date"])
    df["End_Date"] = pd.to_datetime(df["End_Date"])

    logger.info(f"Loaded {len(df)} raw historical rows ({df['City'].nunique()} cities)")

    return df


def attach_geography(df):
    """Elevation is already present in the raw CSV; Coastal_Flag is not -
    attach it from the static per-city lookup. No fitting involved (these
    are fixed city-level facts, identical across the whole date range)."""

    df = df.copy()
    df["Coastal_Flag"] = df["City"].map(COASTAL_MAP)

    missing = df.loc[df["Coastal_Flag"].isna(), "City"].unique()
    if len(missing) > 0:
        raise ValueError(f"No Coastal_Flag mapping for cities: {list(missing)}")

    # Sanity-check Elevation matches the canonical map (raw CSV already
    # carries its own Elevation column from the original data drop).
    expected_elevation = df["City"].map(ELEVATION_MAP)
    mismatched = df.loc[df["Elevation"] != expected_elevation, "City"].unique()
    if len(mismatched) > 0:
        logger.warning(f"Elevation mismatch vs ELEVATION_MAP for: {list(mismatched)}")

    return df


def assign_period(df, train_year_end=TRAIN_YEARS_END, test_year_start=TEST_YEARS_START):
    """Step 5: chronological train/test period, by End_Date year.

    Parameterized (rather than hard-coded to the primary split) so
    ML/walkforward_validate.py can reuse the identical pipeline for each
    fold's own train_year_end/test_year_start boundary."""

    df = df.copy()
    df["Year"] = df["End_Date"].dt.year
    df["Period"] = np.where(
        df["Year"] <= train_year_end, "train",
        np.where(df["Year"] >= test_year_start, "test", "excluded")
    )
    return df


def compute_hazard(df):
    """Steps 6-7: fit rainfall min/max on the TRAINING PERIOD only, apply
    to every row, clip to [0, 1]."""

    train_rainfall = df.loc[df["Period"] == "train", "Rainfall_3Day"]
    r_min, r_max = train_rainfall.min(), train_rainfall.max()

    logger.info(f"Rainfall_3Day normalization fit on training period: min={r_min}, max={r_max}")

    df = df.copy()
    df["Hazard"] = ((df["Rainfall_3Day"] - r_min) / (r_max - r_min)).clip(0.0, 1.0)

    return df, {"rainfall_min": float(r_min), "rainfall_max": float(r_max)}


def compute_vulnerability(df):
    """Step 8: static per-city Vulnerability = 0.5*InverseElevation +
    0.5*Coastal_Flag. Elevation normalization uses the fixed 30-city
    ELEVATION_MAP (not a train/test-fitted quantity - elevation doesn't
    vary over time), clipped to [0.05, 0.95] so no city can reach an
    exact 0 or 1 (the fix for the Hatton zero-vulnerability edge case
    found during methodology review: at max elevation, an unclipped
    1-norm formula would zero out Vulnerability regardless of rainfall)."""

    elevations = pd.Series(ELEVATION_MAP)
    e_min, e_max = elevations.min(), elevations.max()

    df = df.copy()
    elevation_norm = (df["Elevation"] - e_min) / (e_max - e_min)
    elevation_norm_clipped = elevation_norm.clip(0.05, 0.95)
    inverse_elevation = 1 - elevation_norm_clipped

    df["Vulnerability"] = 0.5 * inverse_elevation + 0.5 * df["Coastal_Flag"]

    return df, {"elevation_min": float(e_min), "elevation_max": float(e_max)}


def compute_risk_score_and_labels(df):
    """Steps 9-11: RiskScore = Hazard * Vulnerability; GLOBAL percentile
    thresholds fit on TRAINING PERIOD RiskScore only, applied unchanged
    to every row (train and test)."""

    df = df.copy()
    df["RiskScore"] = df["Hazard"] * df["Vulnerability"]

    train_scores = df.loc[df["Period"] == "train", "RiskScore"]

    thresholds = {
        name: float(np.quantile(train_scores, q))
        for name, q in RISK_PERCENTILE_BOUNDARIES.items()
    }
    logger.info(f"Global percentile thresholds (fit on training RiskScore): {thresholds}")

    def classify(score):
        if score >= thresholds["Extreme"]:
            return "Extreme"
        if score >= thresholds["High"]:
            return "High"
        if score >= thresholds["Medium"]:
            return "Medium"
        return "Low"

    df["Flood_Risk"] = df["RiskScore"].apply(classify)

    return df, thresholds


def build_t_plus_1_pairs(df):
    """Steps 12-14: shift the label back one day per city so a row's
    target is the FOLLOWING day's label (features stay at t); drop each
    city's final row (no t+1 available); drop the one pair per city
    whose t -> t+1 crosses the train/test boundary."""

    df = df.sort_values(["City", "End_Date"]).reset_index(drop=True)

    pairs = []
    dropped_no_next = 0
    dropped_boundary = 0

    for city, g in df.groupby("City"):
        g = g.sort_values("End_Date").reset_index(drop=True)

        for i in range(len(g) - 1):
            row_t = g.iloc[i]
            row_t1 = g.iloc[i + 1]

            # Must be consecutive days - the dataset is dense (verified
            # during investigation), but guard against any gap anyway.
            if (row_t1["End_Date"] - row_t["End_Date"]).days != 1:
                dropped_no_next += 1
                continue

            if row_t["Period"] != row_t1["Period"]:
                # t is the last training-period day and t+1 is the first
                # test-period day (or vice versa) - exclude this single
                # boundary-straddling pair per city rather than let a
                # cross-period label sit in either split.
                dropped_boundary += 1
                continue

            if row_t["Period"] not in ("train", "test"):
                continue

            pairs.append({
                "Date": row_t["End_Date"],
                "City": city,
                "Rainfall_3Day": row_t["Rainfall_3Day"],
                "Avg_Temperature": row_t["Avg_Temperature"],
                "Avg_WindSpeed": row_t["Avg_WindSpeed"],
                "Elevation": row_t["Elevation"],
                "Coastal_Flag": row_t["Coastal_Flag"],
                "Flood_Risk_Previous_Day": row_t["Flood_Risk"],
                "Flood_Risk": row_t1["Flood_Risk"],
                "Period": row_t["Period"],
            })

        dropped_no_next += 1  # each city's final row has no t+1

    result = pd.DataFrame(pairs)

    logger.info(
        f"Built {len(result)} t->t+1 pairs "
        f"({dropped_boundary} boundary pairs dropped, "
        f"{df['City'].nunique()} rows dropped as each city's final day)"
    )

    return result


def main():
    df = load_raw()
    df = attach_geography(df)
    df = assign_period(df)
    df, rainfall_norm = compute_hazard(df)
    df, elevation_norm = compute_vulnerability(df)
    df, thresholds = compute_risk_score_and_labels(df)

    df.to_csv(PROCESSED_DATASET_CSV, index=False)
    logger.info(f"Saved processed (pre-pairing, one row per city-day) dataset -> {PROCESSED_DATASET_CSV}")

    pairs = build_t_plus_1_pairs(df)

    train_df = pairs[pairs["Period"] == "train"].drop(columns=["Period"])
    test_df = pairs[pairs["Period"] == "test"].drop(columns=["Period"])

    train_df.to_csv(TRAIN_OUT_CSV, index=False)
    test_df.to_csv(TEST_OUT_CSV, index=False)

    logger.info(f"Saved train_dataset.csv ({len(train_df)} rows) -> {TRAIN_OUT_CSV}")
    logger.info(f"Saved test_dataset.csv ({len(test_df)} rows) -> {TEST_OUT_CSV}")

    print("\n===== DATASET PREPARATION SUMMARY =====")
    print(f"Rainfall normalization (fit on train): {rainfall_norm}")
    print(f"Elevation normalization (static, all cities): {elevation_norm}")
    print(f"Global percentile thresholds (fit on train RiskScore): {thresholds}")
    print(f"\nTrain rows: {len(train_df)}   Test rows: {len(test_df)}")
    print("\nTrain Flood_Risk distribution:")
    print(train_df["Flood_Risk"].value_counts())
    print(train_df["Flood_Risk"].value_counts(normalize=True).mul(100).round(4))
    print("\nTest Flood_Risk distribution:")
    print(test_df["Flood_Risk"].value_counts())
    print(test_df["Flood_Risk"].value_counts(normalize=True).mul(100).round(4))


if __name__ == "__main__":
    main()
