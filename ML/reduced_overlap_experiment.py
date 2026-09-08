"""
Reduced-overlap forecast experiment (supervisor review, Priority 2).

Question: does persistence beat the trained models because it genuinely
tracks flood risk, or because Rainfall_3Day(t) and Rainfall_3Day(t+1)
are 3-day rolling sums that share 2 of their 3 summed days by
construction (Pearson r ~ 0.8552, per the paper's existing analysis)?

If the "persistence wins" result is driven by that window-overlap
artifact rather than genuine forecasting difficulty, its advantage
should shrink as the lead time grows and the shared days disappear:

  lead = 1 day  -> Rainfall_3Day(t) and Rainfall_3Day(t+1) share 2/3 days
  lead = 2 days -> share 1/3 days
  lead = 3 days -> share 0/3 days (windows are fully disjoint)

This script rebuilds t -> t+lead pairs (instead of the fixed t -> t+1
pairs in ML/prepare_dataset.py::build_t_plus_1_pairs) for lead in
{1, 2, 3}, using the SAME Hazard/Vulnerability/RiskScore/Flood_Risk
labels already frozen in ML/data/processed_dataset.csv - only the
pairing offset changes, not the label construction. Persistence at
lead k is generalised the same way: "day t's label predicts day t+k's
label". Random Forest is retrained at each lead with the frozen
production hyperparameters (see ML/model_selector.py) on the primary
chronological split.

Also reports the raw Pearson correlation between Rainfall_3Day(t) and
Rainfall_3Day(t+lead) at each lead, as the direct evidence for the
window-overlap explanation (not just its downstream effect on F1).

Does not touch ML/data/processed_dataset.csv, train_dataset.csv,
test_dataset.csv, or the frozen production model. Writes its own
results file only.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score
from sklearn.preprocessing import LabelEncoder

from ML.utils import PROCESSED_DATASET_CSV, REPORTS_DIR

RESULTS_CSV = os.path.join(REPORTS_DIR, "reduced_overlap_results.csv")
CORR_CSV = os.path.join(REPORTS_DIR, "reduced_overlap_correlations.csv")

RF_PARAMS = dict(
    n_estimators=100,
    random_state=42,
    class_weight="balanced",
    max_depth=20,
    min_samples_leaf=2,
)

FEATURE_COLS = ["City_Encoded", "Rainfall_3Day", "Avg_Temperature", "Avg_WindSpeed", "Elevation", "Coastal_Flag"]

LEADS = [1, 2, 3]


def build_t_plus_k_pairs(df, k):
    """Generalises ML/prepare_dataset.py::build_t_plus_1_pairs to an
    arbitrary lead k: features stay at day t, target is day t+k's label,
    persistence prediction is day t's own label. Drops any pair whose
    t -> t+k span is not exactly k consecutive days (gap guard, same as
    the original) or that crosses the train/test boundary."""

    df = df.sort_values(["City", "End_Date"]).reset_index(drop=True)

    pairs = []
    dropped_no_next = 0
    dropped_boundary = 0

    for city, g in df.groupby("City"):
        g = g.sort_values("End_Date").reset_index(drop=True)

        for i in range(len(g) - k):
            row_t = g.iloc[i]
            row_tk = g.iloc[i + k]

            if (row_tk["End_Date"] - row_t["End_Date"]).days != k:
                dropped_no_next += 1
                continue

            if row_t["Period"] != row_tk["Period"]:
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
                "Flood_Risk_At_T": row_t["Flood_Risk"],
                "Flood_Risk": row_tk["Flood_Risk"],
                "Period": row_t["Period"],
            })

    result = pd.DataFrame(pairs)
    return result, dropped_boundary


def run_lead(base_df, lead):
    pairs, dropped_boundary = build_t_plus_k_pairs(base_df, lead)

    train_df = pairs[pairs["Period"] == "train"].drop(columns=["Period"])
    test_df = pairs[pairs["Period"] == "test"].drop(columns=["Period"])

    city_encoder = LabelEncoder().fit(pd.concat([train_df["City"], test_df["City"]]))
    train_df["City_Encoded"] = city_encoder.transform(train_df["City"])
    test_df["City_Encoded"] = city_encoder.transform(test_df["City"])

    label_encoder = LabelEncoder().fit(pd.concat([train_df["Flood_Risk"], test_df["Flood_Risk"]]))
    y_train = label_encoder.transform(train_df["Flood_Risk"])
    y_test = label_encoder.transform(test_df["Flood_Risk"])

    clf = RandomForestClassifier(**RF_PARAMS)
    clf.fit(train_df[FEATURE_COLS], y_train)
    y_pred_rf = clf.predict(test_df[FEATURE_COLS])
    rf_macro_f1 = f1_score(y_test, y_pred_rf, average="macro")

    y_pred_persist = label_encoder.transform(test_df["Flood_Risk_At_T"])
    persist_macro_f1 = f1_score(y_test, y_pred_persist, average="macro")

    return {
        "Lead_Days": lead,
        "Train_Rows": len(train_df),
        "Test_Rows": len(test_df),
        "Boundary_Pairs_Dropped": dropped_boundary,
        "Persistence_Macro_F1": round(persist_macro_f1, 4),
        "RF_Macro_F1": round(rf_macro_f1, 4),
        "Persistence_Wins": persist_macro_f1 > rf_macro_f1,
        "Persistence_Margin": round(persist_macro_f1 - rf_macro_f1, 4),
    }


def rainfall_window_correlation(base_df, lead):
    """Direct evidence for the overlap explanation: Pearson r between
    Rainfall_3Day(t) and Rainfall_3Day(t+lead), pooled across all cities,
    using only rows that are exactly `lead` consecutive days apart within
    the same city (mirrors the pairing logic above, without the RF
    train/test split machinery)."""

    df = base_df.sort_values(["City", "End_Date"]).reset_index(drop=True)
    t_vals, tk_vals = [], []

    for city, g in df.groupby("City"):
        g = g.sort_values("End_Date").reset_index(drop=True)
        for i in range(len(g) - lead):
            row_t = g.iloc[i]
            row_tk = g.iloc[i + lead]
            if (row_tk["End_Date"] - row_t["End_Date"]).days != lead:
                continue
            t_vals.append(row_t["Rainfall_3Day"])
            tk_vals.append(row_tk["Rainfall_3Day"])

    r = float(np.corrcoef(t_vals, tk_vals)[0, 1])
    shared_days = max(0, 3 - lead)
    return {"Lead_Days": lead, "Shared_Window_Days": shared_days, "Pearson_r": round(r, 4), "N_Pairs": len(t_vals)}


def main():
    print("Loading processed dataset...")
    base_df = pd.read_csv(PROCESSED_DATASET_CSV, parse_dates=["Start_Date", "End_Date"])
    print(f"{len(base_df)} rows, {base_df['City'].nunique()} cities")

    corr_results = []
    for lead in LEADS:
        c = rainfall_window_correlation(base_df, lead)
        corr_results.append(c)
        print(f"lead={lead}: shared_days={c['Shared_Window_Days']}  r={c['Pearson_r']}  n={c['N_Pairs']}")

    corr_out = pd.DataFrame(corr_results)
    corr_out.to_csv(CORR_CSV, index=False)
    print(f"Saved -> {CORR_CSV}\n")

    results = []
    for lead in LEADS:
        print(f"=== lead = t+{lead} ===")
        r = run_lead(base_df, lead)
        print(f"  Persistence macro-F1 = {r['Persistence_Macro_F1']:.4f}   "
              f"RF macro-F1 = {r['RF_Macro_F1']:.4f}   "
              f"margin = {r['Persistence_Margin']:+.4f}   "
              f"Persistence wins: {r['Persistence_Wins']}")
        results.append(r)

    out = pd.DataFrame(results)
    out.to_csv(RESULTS_CSV, index=False)
    print(f"\nSaved -> {RESULTS_CSV}")

    print("\n===== SUMMARY =====")
    print(out[["Lead_Days", "Persistence_Macro_F1", "RF_Macro_F1", "Persistence_Margin", "Persistence_Wins"]].to_string(index=False))
    print(
        "\nIf Persistence_Margin shrinks toward 0 (or reverses) as Lead_Days "
        "increases, this supports the window-overlap explanation - "
        "persistence's advantage is tied to shared rolling-window days, "
        "not to a general forecasting advantage over the trained models."
    )


if __name__ == "__main__":
    main()
