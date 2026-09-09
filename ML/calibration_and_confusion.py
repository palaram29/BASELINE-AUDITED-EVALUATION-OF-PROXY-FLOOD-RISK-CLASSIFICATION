"""
Calibration and full confusion matrices (supervisor review, 9 Sep).

The prototype exposes a probability alongside every ML prediction
(Probability in prediction_results, see backend/predict_flood.py), so an
operator or citizen could reasonably read that number as "how confident
is this." This script checks whether that's actually true: multiclass
Brier score and Expected Calibration Error (ECE) for the frozen Random
Forest's predict_proba output. It also prints full 4-class
precision/recall/F1/support and confusion matrices for persistence and
Random Forest side by side, since the paper currently reports High/
Extreme recall as single numbers rather than the full breakdown the
review asked for.

Does not retrain anything. Writes its own results file only.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.preprocessing import LabelEncoder, label_binarize

from backend.config import TRAIN_DATA_FILE, TEST_DATA_FILE
from ML.utils import REPORTS_DIR, BEST_MODEL_PATH, FEATURE_COLUMNS

RESULTS_JSON = os.path.join(REPORTS_DIR, "calibration_and_confusion.json")
CLASS_ORDER = ["Low", "Medium", "High", "Extreme"]
N_BINS = 10


def multiclass_brier_score(y_true_bin, y_proba):
    """Mean squared error between predicted probabilities and one-hot
    true labels, averaged over all classes and rows (the standard
    multiclass generalisation of the binary Brier score)."""
    return float(np.mean(np.sum((y_proba - y_true_bin) ** 2, axis=1)))


def expected_calibration_error(y_true_idx, y_proba, n_bins=N_BINS):
    """Standard ECE: bins predictions by the model's own top-class
    confidence, then compares that confidence to the actual accuracy
    within each bin, weighted by bin size."""
    confidences = y_proba.max(axis=1)
    predictions = y_proba.argmax(axis=1)
    correct = (predictions == y_true_idx).astype(float)

    bin_edges = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    bin_report = []
    for lo, hi in zip(bin_edges[:-1], bin_edges[1:]):
        mask = (confidences > lo) & (confidences <= hi) if lo > 0 else (confidences >= lo) & (confidences <= hi)
        if mask.sum() == 0:
            continue
        bin_confidence = confidences[mask].mean()
        bin_accuracy = correct[mask].mean()
        weight = mask.sum() / len(confidences)
        ece += weight * abs(bin_accuracy - bin_confidence)
        bin_report.append({
            "bin": f"({lo:.1f}, {hi:.1f}]",
            "n": int(mask.sum()),
            "mean_confidence": round(float(bin_confidence), 4),
            "accuracy": round(float(bin_accuracy), 4),
        })
    return float(ece), bin_report


def full_report(y_true, y_pred, name):
    report = classification_report(y_true, y_pred, labels=CLASS_ORDER, target_names=CLASS_ORDER, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=CLASS_ORDER)

    print(f"\n--- {name}: per-class precision / recall / F1 / support ---")
    for c in CLASS_ORDER:
        r = report[c]
        print(f"  {c:8s} precision={r['precision']:.4f}  recall={r['recall']:.4f}  "
              f"f1={r['f1-score']:.4f}  support={int(r['support'])}")

    print(f"--- {name}: confusion matrix (rows=true, cols=predicted, order {CLASS_ORDER}) ---")
    print(pd.DataFrame(cm, index=CLASS_ORDER, columns=CLASS_ORDER).to_string())

    return {"classification_report": report, "confusion_matrix": cm.tolist()}


def main():
    train_df = pd.read_csv(TRAIN_DATA_FILE)
    test_df = pd.read_csv(TEST_DATA_FILE)

    city_encoder = LabelEncoder().fit(pd.concat([train_df["City"], test_df["City"]]))
    test_df["City_Encoded"] = city_encoder.transform(test_df["City"])

    label_encoder = LabelEncoder().fit(train_df["Flood_Risk"])
    class_order_idx = [list(label_encoder.classes_).index(c) for c in CLASS_ORDER]

    model = joblib.load(BEST_MODEL_PATH)
    y_true = test_df["Flood_Risk"]
    y_true_idx = label_encoder.transform(y_true)
    y_proba_raw = model.predict_proba(test_df[FEATURE_COLUMNS])
    y_proba = y_proba_raw[:, class_order_idx]  # reorder columns to CLASS_ORDER
    y_pred = label_encoder.inverse_transform(model.predict(test_df[FEATURE_COLUMNS]))

    y_true_idx_reordered = y_true.map({c: i for i, c in enumerate(CLASS_ORDER)}).values
    y_true_bin = label_binarize(y_true_idx_reordered, classes=range(len(CLASS_ORDER)))

    brier = multiclass_brier_score(y_true_bin, y_proba)
    ece, bin_report = expected_calibration_error(y_true_idx_reordered, y_proba)

    print("===== CALIBRATION (frozen Random Forest) =====")
    print(f"Multiclass Brier score: {brier:.4f}  (0 = perfect, higher = worse; "
          f"a model that always predicts the training class distribution scores "
          f"noticeably above 0 here given the imbalance)")
    print(f"Expected Calibration Error (10 bins, top-class confidence): {ece:.4f}")
    print("\nPer-bin detail:")
    print(pd.DataFrame(bin_report).to_string(index=False))

    rf_detail = full_report(y_true, y_pred, "Random Forest (frozen)")
    persist_detail = full_report(y_true, test_df["Flood_Risk_Previous_Day"], "Persistence")

    payload = {
        "brier_score": round(brier, 4),
        "ece": round(ece, 4),
        "ece_bins": bin_report,
        "random_forest": rf_detail,
        "persistence": persist_detail,
    }
    with open(RESULTS_JSON, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"\nSaved -> {RESULTS_JSON}")


if __name__ == "__main__":
    main()
