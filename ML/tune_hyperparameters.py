"""
Hyperparameter selection for the flood-risk model comparison.

Selection is confined to a validation period held out from WITHIN the
training years: inner-train 2010-2017, validation 2018-2019. The
2020-2023 test period defined in the main chronological split is never
loaded by this script, so it cannot influence the selected configuration.

The chosen settings are written to ML/reports/hyperparameter_search.csv
and are transcribed by hand into ML/model_selector.py's MODEL_REGISTRY,
so that the deployed configuration is a reviewed decision rather than an
automatic overwrite (consistent with the frozen-model policy in
docs/ML_METHODOLOGY_AND_LIMITATIONS.md).

Usage:
    python ML/tune_hyperparameters.py
    python ML/tune_hyperparameters.py --train-file ML/data/train_dataset.csv
"""

import os
import sys
import argparse

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier

from backend.config import TRAIN_DATA_FILE
from ML.utils import logger, ensure_dirs, REPORTS_DIR, FEATURE_COLUMNS

# Boundary of the inner validation period. Everything on or after this
# date within the training file is held out for scoring candidates.
VALIDATION_START = "2018-01-01"

SEARCH_SPACE = {
    "RandomForest": [
        dict(max_depth=None, min_samples_leaf=1),
        dict(max_depth=10, min_samples_leaf=5),
        dict(max_depth=15, min_samples_leaf=5),
        dict(max_depth=20, min_samples_leaf=2),
        dict(max_depth=15, min_samples_leaf=20),
        dict(max_depth=8, min_samples_leaf=10),
    ],
    "XGBoost": [
        dict(max_depth=6),
        dict(max_depth=5, min_child_weight=5, subsample=0.8, colsample_bytree=0.8),
        dict(max_depth=4, min_child_weight=5, subsample=0.8, colsample_bytree=0.8),
        dict(max_depth=3, min_child_weight=1),
        dict(max_depth=8, min_child_weight=10, subsample=0.8),
        dict(max_depth=5, min_child_weight=20, subsample=0.6, colsample_bytree=0.6),
    ],
    "LightGBM": [
        dict(max_depth=-1),
        dict(max_depth=6, min_child_samples=30),
        dict(max_depth=10, min_child_samples=30),
        dict(max_depth=4, min_child_samples=50),
        dict(max_depth=6, min_child_samples=100),
        dict(max_depth=8, min_child_samples=20),
    ],
}


def build(name, params):
    """Construct one candidate estimator. Fixed settings (seed, tree
    count, learning rate, class weighting) match MODEL_REGISTRY exactly,
    so only the searched constraints differ between candidates."""

    if name == "RandomForest":
        return RandomForestClassifier(
            n_estimators=100, random_state=42, class_weight="balanced", **params
        )
    if name == "XGBoost":
        return XGBClassifier(
            n_estimators=100, learning_rate=0.1, random_state=42,
            eval_metric="mlogloss", **params
        )
    return LGBMClassifier(
        n_estimators=100, learning_rate=0.1, random_state=42,
        class_weight="balanced", verbose=-1, **params
    )


def search(train_file):
    ensure_dirs()

    df = pd.read_csv(train_file, parse_dates=["Date"])
    city_encoder = LabelEncoder().fit(df["City"])
    df["City_Encoded"] = city_encoder.transform(df["City"])
    label_encoder = LabelEncoder().fit(df["Flood_Risk"])

    inner = df[df["Date"] < VALIDATION_START]
    val = df[df["Date"] >= VALIDATION_START]

    logger.info(
        f"Inner-train {len(inner)} rows "
        f"({inner.Date.min():%Y-%m-%d}..{inner.Date.max():%Y-%m-%d}); "
        f"validation {len(val)} rows "
        f"({val.Date.min():%Y-%m-%d}..{val.Date.max():%Y-%m-%d})"
    )

    X_inner = inner[FEATURE_COLUMNS]
    y_inner = label_encoder.transform(inner["Flood_Risk"])
    X_val = val[FEATURE_COLUMNS]
    y_val = label_encoder.transform(val["Flood_Risk"])

    rows = []
    for name, candidates in SEARCH_SPACE.items():
        best_score, best_params = -1.0, None

        for params in candidates:
            model = build(name, params)
            fit_kwargs = {}
            if name == "XGBoost":
                fit_kwargs["sample_weight"] = compute_sample_weight("balanced", y_inner)

            model.fit(X_inner, y_inner, **fit_kwargs)
            score = f1_score(y_val, model.predict(X_val), average="macro")

            rows.append({
                "model": name,
                "params": str(params),
                "validation_macro_f1": round(score, 4),
            })
            logger.info(f"{name} {params} -> validation macro-F1 {score:.4f}")

            if score > best_score:
                best_score, best_params = score, params

        for row in rows:
            if row["model"] == name and row["params"] == str(best_params):
                row["selected"] = True
        logger.info(f"{name} SELECTED {best_params} (validation macro-F1 {best_score:.4f})")

    results = pd.DataFrame(rows).fillna({"selected": False})
    out_path = os.path.join(REPORTS_DIR, "hyperparameter_search.csv")
    results.to_csv(out_path, index=False)
    logger.info(f"Saved hyperparameter search -> {out_path}")

    print("\n===== HYPERPARAMETER SEARCH (validation macro-F1) =====\n")
    print(results.to_string(index=False))
    print(
        "\nTranscribe the rows marked selected=True into MODEL_REGISTRY "
        "in ML/model_selector.py, then rerun ML/train_models.py."
    )
    return results


def main():
    parser = argparse.ArgumentParser(
        description="Select hyperparameters on a validation split held out from the training period."
    )
    parser.add_argument("--train-file", default=TRAIN_DATA_FILE)
    args = parser.parse_args()
    search(args.train_file)


if __name__ == "__main__":
    main()
