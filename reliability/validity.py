"""
Validity scoring: per-variable data-quality checks for the environmental
variables (rainfall, temperature, wind speed, river water level), plus
batch-level checks (nulls, duplicates, invalid timestamps, outliers).

Nothing here ever drops a row. `validate_batch` returns per-row flags
(is_valid / issue_type) alongside the original data so the caller can
persist the original values unchanged (see backend/services/
reliability_service.py -> data_validation_log) while still excluding
flagged rows from the validity SCORE.
"""

import math

import pandas as pd

from . import config as cfg


def _is_number(value):
    if value is None:
        return False
    try:
        f = float(value)
    except (TypeError, ValueError):
        return False
    return not (math.isnan(f) or math.isinf(f))


def validate_rainfall(value):
    if not _is_number(value):
        return False, "invalid_type"
    v = float(value)
    if v < 0:
        return False, "negative_value"
    if v < cfg.RAINFALL_MIN or v > cfg.RAINFALL_MAX:
        return False, "invalid_range"
    return True, None


def validate_temperature(value):
    if not _is_number(value):
        return False, "invalid_type"
    v = float(value)
    if v < cfg.TEMPERATURE_MIN or v > cfg.TEMPERATURE_MAX:
        return False, "invalid_range"
    return True, None


def validate_windspeed(value):
    if not _is_number(value):
        return False, "invalid_type"
    v = float(value)
    if v < 0:
        return False, "negative_value"
    if v < cfg.WINDSPEED_MIN or v > cfg.WINDSPEED_MAX:
        return False, "invalid_range"
    return True, None


def validate_river_level(value):
    if not _is_number(value):
        return False, "invalid_type"
    v = float(value)
    if v < 0:
        return False, "negative_value"
    if v < cfg.RIVER_LEVEL_MIN or v > cfg.RIVER_LEVEL_MAX:
        return False, "invalid_range"
    return True, None


VALIDATORS = {
    "rainfall": validate_rainfall,
    "temperature": validate_temperature,
    "windspeed": validate_windspeed,
    "river_level": validate_river_level,
}


def validate_timestamp(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return False, "missing_timestamp"
    try:
        pd.Timestamp(value)
    except (TypeError, ValueError):
        return False, "invalid_timestamp"
    return True, None


def detect_outliers_zscore(series, threshold=None):
    """Boolean mask (same index as `series`) of values whose |z-score|
    exceeds `threshold`. Requires >=3 non-null values and non-zero std;
    otherwise nothing is flagged (too little data to judge an outlier)."""
    threshold = cfg.OUTLIER_ZSCORE_THRESHOLD if threshold is None else threshold

    numeric = pd.to_numeric(series, errors="coerce")
    valid = numeric.dropna()
    if len(valid) < 3 or valid.std(ddof=0) == 0:
        return pd.Series(False, index=series.index)

    z = (numeric - valid.mean()) / valid.std(ddof=0)
    return z.abs() > threshold


def validate_batch(df, column_map, timestamp_col=None, duplicate_key_cols=None):
    """Run all validity checks over a DataFrame of raw records without
    dropping any row.

    column_map: {variable_name -> df_column_name}, variable_name one of
        VALIDATORS' keys ("rainfall", "temperature", "windspeed",
        "river_level").
    timestamp_col: optional column name checked for null/unparseable values.
    duplicate_key_cols: optional list of column names identifying a unique
        record; duplicates (beyond the first) are flagged.

    Returns (validity_score, flagged_df, flags) where:
      - validity_score = valid observations / total observations checked
      - flagged_df is a COPY of df with two extra columns: is_valid, issue_type
      - flags is a list of dicts, one per detected issue, ready to persist
        into data_validation_log (field_name, observed_value, issue_type)
    """
    flagged = df.copy()
    flagged["is_valid"] = True
    flagged["issue_type"] = None
    flags = []

    def _flag(idx, field, value, issue_type):
        flagged.loc[idx, "is_valid"] = False
        if not flagged.loc[idx, "issue_type"]:
            flagged.loc[idx, "issue_type"] = issue_type
        flags.append(
            {
                "row_index": idx,
                "field_name": field,
                "observed_value": None if pd.isna(value) else value,
                "issue_type": issue_type,
            }
        )

    total_checks = 0
    valid_checks = 0

    for var_name, col in column_map.items():
        validator = VALIDATORS.get(var_name)
        if validator is None or col not in df.columns:
            continue

        for idx, value in df[col].items():
            total_checks += 1
            if pd.isna(value):
                _flag(idx, col, value, "null")
                continue

            ok, reason = validator(value)
            if ok:
                valid_checks += 1
            else:
                _flag(idx, col, value, reason)

        outlier_mask = detect_outliers_zscore(df[col])
        for idx in df.index[outlier_mask]:
            flags.append(
                {
                    "row_index": idx,
                    "field_name": col,
                    "observed_value": df.loc[idx, col],
                    "issue_type": "outlier",
                }
            )
            # Outliers are surfaced as suspicious for audit but don't by
            # themselves subtract from validity_score if the value already
            # passed range/type checks - a genuine-but-extreme flood
            # reading shouldn't be scored as "invalid".

    if timestamp_col and timestamp_col in df.columns:
        for idx, value in df[timestamp_col].items():
            total_checks += 1
            ok, reason = validate_timestamp(value)
            if ok:
                valid_checks += 1
            else:
                _flag(idx, timestamp_col, value, reason)

    if duplicate_key_cols:
        existing_cols = [c for c in duplicate_key_cols if c in df.columns]
        if existing_cols:
            dup_mask = df.duplicated(subset=existing_cols, keep="first")
            for idx in df.index[dup_mask]:
                _flag(idx, ",".join(existing_cols), None, "duplicate")
                total_checks += 1

    validity_score = (valid_checks / total_checks) if total_checks else 1.0
    return validity_score, flagged, flags
