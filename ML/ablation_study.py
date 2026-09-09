"""
Ablation study over feature subsets (supervisor review, 9 Sep).

Question: how much of Random Forest's macro-F1 comes specifically from
the features that built the label (Rainfall_3Day feeds Hazard;
Elevation and Coastal_Flag feed Vulnerability), versus features that
had no part in label construction (Avg_Temperature, Avg_WindSpeed)?
If a model trained on ONLY the label-ingredient features matches or
beats the full feature set, that is direct evidence for the circularity
argument already made via permutation importance; if the
non-label-ingredient features alone do meaningfully better than the
majority baseline, that is evidence the model has learned something
beyond just reconstructing the label rule.

Six feature subsets, frozen RandomForest hyperparameters, primary
chronological split (train_dataset.csv / test_dataset.csv), no
retraining of the production model and no change to the frozen
best_model.pkl. Writes its own results file only.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score
from sklearn.preprocessing import LabelEncoder

from backend.config import TRAIN_DATA_FILE, TEST_DATA_FILE
from ML.utils import REPORTS_DIR

RESULTS_CSV = os.path.join(REPORTS_DIR, "ablation_study_results.csv")

RF_PARAMS = dict(
    n_estimators=100,
    random_state=42,
    class_weight="balanced",
    max_depth=20,
    min_samples_leaf=2,
)

# Every subset includes City_Encoded (a location identifier, not itself
# a label ingredient) so the model can still tell cities apart; the
# ablation varies which CONTINUOUS features are available.
SUBSETS = {
    "Rainfall only": ["City_Encoded", "Rainfall_3Day"],
    "Vulnerability only (elevation+coastal)": ["City_Encoded", "Elevation", "Coastal_Flag"],
    "Weather non-label (temp+wind)": ["City_Encoded", "Avg_Temperature", "Avg_WindSpeed"],
    "Label ingredients (rainfall+vulnerability)": ["City_Encoded", "Rainfall_3Day", "Elevation", "Coastal_Flag"],
    "Full feature set": ["City_Encoded", "Rainfall_3Day", "Avg_Temperature", "Avg_WindSpeed", "Elevation", "Coastal_Flag"],
    "Full set minus label ingredients": ["City_Encoded", "Avg_Temperature", "Avg_WindSpeed"],
}


def main():
    train_df = pd.read_csv(TRAIN_DATA_FILE)
    test_df = pd.read_csv(TEST_DATA_FILE)

    city_encoder = LabelEncoder().fit(pd.concat([train_df["City"], test_df["City"]]))
    train_df["City_Encoded"] = city_encoder.transform(train_df["City"])
    test_df["City_Encoded"] = city_encoder.transform(test_df["City"])

    label_encoder = LabelEncoder().fit(train_df["Flood_Risk"])
    y_train = label_encoder.transform(train_df["Flood_Risk"])
    y_test = label_encoder.transform(test_df["Flood_Risk"])

    results = []
    for subset_name, cols in SUBSETS.items():
        clf = RandomForestClassifier(**RF_PARAMS)
        clf.fit(train_df[cols], y_train)
        y_pred = clf.predict(test_df[cols])
        macro_f1 = f1_score(y_test, y_pred, average="macro")
        print(f"{subset_name:45s} n_features={len(cols)-1:2d}  macro-F1={macro_f1:.4f}")
        results.append({"Feature_Subset": subset_name, "N_Features": len(cols) - 1, "Macro_F1": round(macro_f1, 4)})

    out = pd.DataFrame(results)
    out.to_csv(RESULTS_CSV, index=False)
    print(f"\nSaved -> {RESULTS_CSV}")
    print(
        "\nFor reference: full-set Random Forest scores 0.5780, persistence scores "
        "0.6307, and the majority baseline scores 0.2442 (macro-F1) on this split."
    )


if __name__ == "__main__":
    main()
