"""
Unit tests for the same-day ("Today") rule-based flood-risk index.

These cover the pure rule (classify_risk_score / compute_same_day_risk)
only - no database. get_latest_live_risk / store_live_risk_snapshot need
a live ml_features table and are exercised via the API verification steps
in the plan instead.
"""

import json

import pytest

from ML.utils import LABEL_CONSTRUCTION_JSON
from backend.services import live_risk_service as lrs

with open(LABEL_CONSTRUCTION_JSON) as f:
    PARAMS = json.load(f)

THRESHOLDS = PARAMS["thresholds"]


def test_classify_risk_score_ladder():
    assert lrs.classify_risk_score(0.0, THRESHOLDS) == "Low"
    assert lrs.classify_risk_score(THRESHOLDS["Medium"] - 1e-9, THRESHOLDS) == "Low"
    assert lrs.classify_risk_score(THRESHOLDS["Medium"], THRESHOLDS) == "Medium"
    assert lrs.classify_risk_score(THRESHOLDS["High"], THRESHOLDS) == "High"
    assert lrs.classify_risk_score(THRESHOLDS["Extreme"], THRESHOLDS) == "Extreme"
    assert lrs.classify_risk_score(1.0, THRESHOLDS) == "Extreme"


def test_no_rain_is_low_everywhere():
    for city in PARAMS["vulnerability_by_city"]:
        result = lrs.compute_same_day_risk(city, 0.0)
        assert result["risk_level"] == "Low"
        assert result["hazard"] == 0.0


def test_missing_rainfall_returns_none():
    assert lrs.compute_same_day_risk("Colombo", None) is None


def test_hazard_is_clamped_to_unit_interval():
    # Rainfall far above the frozen train max still clamps Hazard to 1.0.
    result = lrs.compute_same_day_risk("Colombo", PARAMS["rainfall_max"] * 5)
    assert result["hazard"] == 1.0


def test_vulnerability_drives_the_spread():
    # Same extreme rainfall: a high-exposure coastal city lands far above
    # a low-exposure highland city (this is the whole point of the
    # Vulnerability factor - see methodology doc section 3).
    heavy = PARAMS["rainfall_max"]
    colombo = lrs.compute_same_day_risk("Colombo", heavy)
    hatton = lrs.compute_same_day_risk("Hatton", heavy)
    assert colombo["risk_score"] > hatton["risk_score"]
    assert colombo["risk_level"] == "Extreme"
    assert hatton["risk_level"] == "Low"


def test_known_city_matches_manual_formula():
    rainfall = 120.0
    city = "Galle"
    p = PARAMS
    hazard = (rainfall - p["rainfall_min"]) / (p["rainfall_max"] - p["rainfall_min"])
    expected_score = hazard * p["vulnerability_by_city"][city]
    result = lrs.compute_same_day_risk(city, rainfall)
    assert result["risk_score"] == pytest.approx(expected_score, rel=1e-4)
