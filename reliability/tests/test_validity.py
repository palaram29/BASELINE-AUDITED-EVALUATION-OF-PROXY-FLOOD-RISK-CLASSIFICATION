"""Unit tests for reliability/validity.py."""

import pandas as pd

from reliability.validity import (
    validate_rainfall,
    validate_temperature,
    validate_windspeed,
    validate_river_level,
    validate_batch,
    detect_outliers_zscore,
)


def test_rainfall_rejects_negative():
    ok, reason = validate_rainfall(-5)
    assert not ok and reason == "negative_value"


def test_rainfall_rejects_out_of_range():
    ok, reason = validate_rainfall(9999)
    assert not ok and reason == "invalid_range"


def test_rainfall_accepts_valid_value():
    ok, reason = validate_rainfall(12.5)
    assert ok and reason is None


def test_rainfall_rejects_non_numeric():
    ok, reason = validate_rainfall("not-a-number")
    assert not ok and reason == "invalid_type"


def test_temperature_rejects_out_of_range():
    ok, reason = validate_temperature(80)
    assert not ok and reason == "invalid_range"


def test_temperature_accepts_valid_value():
    ok, reason = validate_temperature(29.5)
    assert ok and reason is None


def test_windspeed_rejects_negative():
    ok, reason = validate_windspeed(-1)
    assert not ok and reason == "negative_value"


def test_river_level_rejects_negative():
    ok, reason = validate_river_level(-0.5)
    assert not ok and reason == "negative_value"


def test_river_level_accepts_valid_value():
    ok, reason = validate_river_level(3.2)
    assert ok and reason is None


def test_validate_batch_computes_validity_score_without_dropping_rows():
    df = pd.DataFrame(
        {
            "Rainfall": [10.0, -5.0, None, 15.0],
            "Temperature": [28.0, 29.0, 30.0, 31.0],
        }
    )
    score, flagged, flags = validate_batch(
        df, {"rainfall": "Rainfall", "temperature": "Temperature"}
    )

    # No rows dropped - original data preserved.
    assert len(flagged) == len(df)
    pd.testing.assert_series_equal(flagged["Rainfall"], df["Rainfall"])

    # 2 invalid rainfall observations (negative, null) out of 8 total checks.
    assert flagged.loc[1, "is_valid"] == False
    assert flagged.loc[1, "issue_type"] == "negative_value"
    assert flagged.loc[2, "is_valid"] == False
    assert flagged.loc[2, "issue_type"] == "null"
    assert 0.0 < score < 1.0
    assert any(f["issue_type"] == "negative_value" for f in flags)
    assert any(f["issue_type"] == "null" for f in flags)


def test_validate_batch_flags_duplicates():
    df = pd.DataFrame({"City": ["Colombo", "Colombo", "Galle"], "Date": ["2026-01-01"] * 2 + ["2026-01-01"]})
    score, flagged, flags = validate_batch(
        df, {}, duplicate_key_cols=["City", "Date"]
    )
    assert any(f["issue_type"] == "duplicate" for f in flags)


def test_detect_outliers_zscore():
    # A single wild outlier's own z-score is bounded by ~(n-1)/sqrt(n) since
    # it inflates the std it's measured against - use enough points that a
    # 5000 among ~10s clears a 3.0 threshold comfortably.
    series = pd.Series([10] * 19 + [5000])
    mask = detect_outliers_zscore(series, threshold=3.0)
    assert mask.iloc[19] == True
    assert mask.iloc[0] == False


def test_validate_batch_all_valid_scores_one():
    df = pd.DataFrame({"Rainfall": [1.0, 2.0, 3.0]})
    score, flagged, flags = validate_batch(df, {"rainfall": "Rainfall"})
    assert score == 1.0
    assert flags == []


def _run_all():
    tests = [v for k, v in globals().items() if k.startswith("test_") and callable(v)]
    for t in tests:
        t()
        print(f"PASS {t.__name__}")
    print(f"\n{len(tests)} validity tests passed.")


if __name__ == "__main__":
    _run_all()
