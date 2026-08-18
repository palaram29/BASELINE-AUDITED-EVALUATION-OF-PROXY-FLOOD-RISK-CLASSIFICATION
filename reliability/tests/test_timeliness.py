"""Unit tests for reliability/timeliness.py."""

from datetime import datetime, timedelta

from reliability.timeliness import compute_timeliness


def test_on_time_scores_one():
    expected = datetime(2026, 1, 1, 12, 0)
    actual = expected + timedelta(minutes=10)
    score = compute_timeliness(actual, expected, acceptable_delay_minutes=90, max_delay_minutes=360)
    assert score == 1.0


def test_early_arrival_scores_one():
    expected = datetime(2026, 1, 1, 12, 0)
    actual = expected - timedelta(minutes=30)
    score = compute_timeliness(actual, expected, acceptable_delay_minutes=90, max_delay_minutes=360)
    assert score == 1.0


def test_delay_beyond_max_scores_zero():
    expected = datetime(2026, 1, 1, 12, 0)
    actual = expected + timedelta(hours=10)
    score = compute_timeliness(actual, expected, acceptable_delay_minutes=90, max_delay_minutes=360)
    assert score == 0.0


def test_delay_between_thresholds_is_linear():
    expected = datetime(2026, 1, 1, 12, 0)
    # Halfway between 90 and 360 minutes -> score ~0.5
    actual = expected + timedelta(minutes=(90 + 360) / 2)
    score = compute_timeliness(actual, expected, acceptable_delay_minutes=90, max_delay_minutes=360)
    assert abs(score - 0.5) < 1e-9


def test_missing_timestamp_scores_zero():
    assert compute_timeliness(None, datetime(2026, 1, 1)) == 0.0
    assert compute_timeliness(datetime(2026, 1, 1), None) == 0.0


def _run_all():
    tests = [v for k, v in globals().items() if k.startswith("test_") and callable(v)]
    for t in tests:
        t()
        print(f"PASS {t.__name__}")
    print(f"\n{len(tests)} timeliness tests passed.")


if __name__ == "__main__":
    _run_all()
