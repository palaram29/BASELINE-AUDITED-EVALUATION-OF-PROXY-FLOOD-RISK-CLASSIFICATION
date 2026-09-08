"""
Target sensitivity analysis (supervisor review, Priority 1).

Question: does the headline finding "persistence beats every trained
model on macro-F1" survive alternative, equally-defensible choices for
the two arbitrary parts of the label construction -

  (a) the 0.5/0.5 InverseElevation/Coastal_Flag weighting inside
      Vulnerability = w_elev*InverseElevation + w_coast*Coastal_Flag
  (b) the 95/98/99.5 percentile cutoffs used to bucket RiskScore into
      Low/Medium/High/Extreme

- or is the primary-split result an artifact of one specific, untested
choice of those parameters?

Re-derives Hazard/Vulnerability/RiskScore/Flood_Risk from
ML/data/processed_dataset.csv (which already carries Rainfall_3Day,
Elevation, Coastal_Flag, Period) for each candidate parameterisation,
rebuilds t->t+1 pairs with the existing build_t_plus_1_pairs() function,
retrains RandomForest with the frozen best hyperparameters (n_estimators
=100, max_depth=20, min_samples_leaf=2, class_weight="balanced",
random_state=42 - see ML/model_selector.py) on the primary chronological
split, and compares its test macro-F1 against the persistence baseline
(previous day's label) under the SAME re-derived labels.

Does not touch ML/data/processed_dataset.csv, train_dataset.csv or
test_dataset.csv, and does not alter the frozen production model. Writes
its own results file only.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score
from sklearn.preprocessing import LabelEncoder

from ML.utils import PROCESSED_DATASET_CSV, ELEVATION_MAP, REPORTS_DIR
from ML.prepare_dataset import build_t_plus_1_pairs

RESULTS_CSV = os.path.join(REPORTS_DIR, "target_sensitivity_results.csv")

RF_PARAMS = dict(
    n_estimators=100,
    random_state=42,
    class_weight="balanced",
    max_depth=20,
    min_samples_leaf=2,
)

# (label, w_elev, w_coast, thresholds{Medium,High,Extreme})
BASELINE_THRESH = {"Medium": 0.95, "High": 0.98, "Extreme": 0.995}
VARIANTS = [
    ("Baseline (0.5/0.5, 95/98/99.5)", 0.5, 0.5, BASELINE_THRESH),
    ("Weight 0.6/0.4",                 0.6, 0.4, BASELINE_THRESH),
    ("Weight 0.7/0.3",                 0.7, 0.3, BASELINE_THRESH),
    ("Weight 0.8/0.2",                 0.8, 0.2, BASELINE_THRESH),
    ("Thresholds 90/97/99",            0.5, 0.5, {"Medium": 0.90, "High": 0.97, "Extreme": 0.99}),
    ("Thresholds 95/98/99",            0.5, 0.5, {"Medium": 0.95, "High": 0.98, "Extreme": 0.99}),
]


def build_labels(df, w_elev, w_coast, thresholds):
    df = df.copy()

    elevations = pd.Series(ELEVATION_MAP)
    e_min, e_max = elevations.min(), elevations.max()
    elevation_norm = (df["Elevation"] - e_min) / (e_max - e_min)
    elevation_norm_clipped = elevation_norm.clip(0.05, 0.95)
    inverse_elevation = 1 - elevation_norm_clipped

    df["Vulnerability_v"] = w_elev * inverse_elevation + w_coast * df["Coastal_Flag"]
    df["RiskScore_v"] = df["Hazard"] * df["Vulnerability_v"]

    train_scores = df.loc[df["Period"] == "train", "RiskScore_v"]
    qs = {name: float(np.quantile(train_scores, q)) for name, q in thresholds.items()}

    def classify(score):
        if score >= qs["Extreme"]:
            return "Extreme"
        if score >= qs["High"]:
            return "High"
        if score >= qs["Medium"]:
            return "Medium"
        return "Low"

    df["Flood_Risk"] = df["RiskScore_v"].apply(classify)
    return df, qs


def run_variant(base_df, label, w_elev, w_coast, thresholds):
    df, qs = build_labels(base_df, w_elev, w_coast, thresholds)
    pairs = build_t_plus_1_pairs(df)

    train_df = pairs[pairs["Period"] == "train"].drop(columns=["Period"])
    test_df = pairs[pairs["Period"] == "test"].drop(columns=["Period"])

    city_encoder = LabelEncoder().fit(pd.concat([train_df["City"], test_df["City"]]))
    train_df["City_Encoded"] = city_encoder.transform(train_df["City"])
    test_df["City_Encoded"] = city_encoder.transform(test_df["City"])

    feature_cols = ["City_Encoded", "Rainfall_3Day", "Avg_Temperature", "Avg_WindSpeed", "Elevation", "Coastal_Flag"]

    label_encoder = LabelEncoder().fit(pd.concat([train_df["Flood_Risk"], test_df["Flood_Risk"]]))
    y_train = label_encoder.transform(train_df["Flood_Risk"])
    y_test = label_encoder.transform(test_df["Flood_Risk"])

    clf = RandomForestClassifier(**RF_PARAMS)
    clf.fit(train_df[feature_cols], y_train)
    y_pred_rf = clf.predict(test_df[feature_cols])
    rf_macro_f1 = f1_score(y_test, y_pred_rf, average="macro")

    y_pred_persist = label_encoder.transform(test_df["Flood_Risk_Previous_Day"])
    persist_macro_f1 = f1_score(y_test, y_pred_persist, average="macro")

    class_dist = train_df["Flood_Risk"].value_counts(normalize=True).mul(100).round(3).to_dict()

    return {
        "Variant": label,
        "w_elev": w_elev,
        "w_coast": w_coast,
        "Thresholds": thresholds,
        "Fitted_Quantiles": qs,
        "Train_Rows": len(train_df),
        "Test_Rows": len(test_df),
        "Persistence_Macro_F1": round(persist_macro_f1, 4),
        "RF_Macro_F1": round(rf_macro_f1, 4),
        "Persistence_Wins": persist_macro_f1 > rf_macro_f1,
        "Train_Class_Dist_%": class_dist,
    }


def main():
    print("Loading processed dataset...")
    base_df = pd.read_csv(PROCESSED_DATASET_CSV, parse_dates=["Start_Date", "End_Date"])
    print(f"{len(base_df)} rows, {base_df['City'].nunique()} cities")

    results = []
    for label, w_elev, w_coast, thresholds in VARIANTS:
        print(f"\n=== {label} ===")
        r = run_variant(base_df, label, w_elev, w_coast, thresholds)
        print(f"  Persistence macro-F1 = {r['Persistence_Macro_F1']:.4f}   "
              f"RF macro-F1 = {r['RF_Macro_F1']:.4f}   "
              f"Persistence wins: {r['Persistence_Wins']}")
        print(f"  Train class distribution (%): {r['Train_Class_Dist_%']}")
        results.append(r)

    out = pd.DataFrame(results)
    out.to_csv(RESULTS_CSV, index=False)
    print(f"\nSaved -> {RESULTS_CSV}")

    print("\n===== SUMMARY =====")
    print(out[["Variant", "Persistence_Macro_F1", "RF_Macro_F1", "Persistence_Wins"]].to_string(index=False))
    print(f"\nPersistence wins in {out['Persistence_Wins'].sum()}/{len(out)} variants.")


if __name__ == "__main__":
    main()
