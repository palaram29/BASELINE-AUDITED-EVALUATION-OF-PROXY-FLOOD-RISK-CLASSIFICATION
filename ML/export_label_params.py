"""
Freeze the Hazard x Vulnerability label-construction parameters as a JSON
artifact so the live "Today" (same-day) risk index can be computed
consistently with how the frozen t+1 model's own training labels were
built.

These three quantities are produced by ML/prepare_dataset.py but only
*printed* there - this script re-derives them from the processed dataset
(ML/data/processed_dataset.csv, one row per city-day, pre-pairing) and
writes them to ML/reports/label_construction.json:

  - rainfall_min / rainfall_max : Rainfall_3Day normalization, fit on the
    TRAINING PERIOD only (same as compute_hazard()).
  - thresholds                  : GLOBAL RiskScore percentile cut points
    for Medium/High/Extreme, fit on TRAINING PERIOD RiskScore only (same
    as compute_risk_score_and_labels()).
  - vulnerability_by_city       : the static per-city Vulnerability value
    (0.5*InverseElevation + 0.5*Coastal_Flag). Taken straight from the
    processed dataset rather than recomputed from ML.utils.ELEVATION_MAP,
    because the raw historical CSV carries its own slightly different
    Elevation column and the labels were built from THAT.

This does NOT train or modify any model. Re-run it only after
ML/prepare_dataset.py is re-run (i.e. the label definition itself
changed).
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone

import numpy as np
import pandas as pd

from ML.utils import (
    logger,
    PROCESSED_DATASET_CSV,
    LABEL_CONSTRUCTION_JSON,
    RISK_PERCENTILE_BOUNDARIES,
    TRAIN_YEARS_END,
    TEST_YEARS_START,
    save_json,
)


def build_params():
    if not os.path.exists(PROCESSED_DATASET_CSV):
        raise FileNotFoundError(
            f"{PROCESSED_DATASET_CSV} not found. Run `python ML/prepare_dataset.py` "
            "first - it produces the processed (pre-pairing) dataset this reads."
        )

    df = pd.read_csv(PROCESSED_DATASET_CSV)

    for col in ("Period", "Rainfall_3Day", "RiskScore", "Vulnerability", "City"):
        if col not in df.columns:
            raise ValueError(
                f"{PROCESSED_DATASET_CSV} is missing the '{col}' column - it looks "
                "like it was produced by an older ML/prepare_dataset.py. Re-run that script."
            )

    train = df[df["Period"] == "train"]
    if train.empty:
        raise ValueError("No rows with Period == 'train' in the processed dataset.")

    r_min = float(train["Rainfall_3Day"].min())
    r_max = float(train["Rainfall_3Day"].max())

    thresholds = {
        name: float(np.quantile(train["RiskScore"], q))
        for name, q in RISK_PERCENTILE_BOUNDARIES.items()
    }

    # Vulnerability is constant per city by construction - assert that and
    # take the single value.
    vuln = df.groupby("City")["Vulnerability"].agg(["nunique", "first"])
    inconsistent = vuln.index[vuln["nunique"] > 1].tolist()
    if inconsistent:
        raise ValueError(f"Vulnerability is not constant per city for: {inconsistent}")

    vulnerability_by_city = {
        city: round(float(value), 6) for city, value in vuln["first"].items()
    }

    return {
        "description": (
            "Frozen Hazard x Vulnerability label-construction parameters, used "
            "to compute the live same-day ('Today') flood-risk index. Consistent "
            "with the frozen t+1 model's training labels. See "
            "docs/ML_METHODOLOGY_AND_LIMITATIONS.md and ML/prepare_dataset.py."
        ),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": os.path.basename(PROCESSED_DATASET_CSV),
        "fit_period": f"training years <= {TRAIN_YEARS_END} (test >= {TEST_YEARS_START})",
        "boundaries_used": RISK_PERCENTILE_BOUNDARIES,
        "rainfall_min": r_min,
        "rainfall_max": r_max,
        "thresholds": thresholds,
        "vulnerability_by_city": vulnerability_by_city,
    }


def main():
    params = build_params()
    save_json(params, LABEL_CONSTRUCTION_JSON)

    logger.info(f"Wrote label-construction params -> {LABEL_CONSTRUCTION_JSON}")

    print("\n===== LABEL CONSTRUCTION PARAMETERS =====")
    print(f"Rainfall_3Day normalization (train): min={params['rainfall_min']}, max={params['rainfall_max']}")
    print(f"RiskScore thresholds (train percentiles): {params['thresholds']}")
    print(f"Cities with a frozen Vulnerability: {len(params['vulnerability_by_city'])}")
    print(f"\nSaved -> {LABEL_CONSTRUCTION_JSON}")


if __name__ == "__main__":
    main()
