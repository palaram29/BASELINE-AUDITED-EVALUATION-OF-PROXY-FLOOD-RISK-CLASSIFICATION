"""Unit tests for reliability/completeness.py.

Runnable directly (python -m reliability.tests.test_completeness) or via
pytest (test_* functions are pytest-discoverable) - no new dependency
required either way.
"""

from datetime import datetime, timedelta

from reliability.completeness import compute_completeness, derive_expected_interval_minutes


def test_derive_expected_interval_from_hourly_history():
    start = datetime(2026, 1, 1)
    timestamps = [start + timedelta(hours=i) for i in range(10)]
    interval = derive_expected_interval_minutes(timestamps)
    assert interval == 60.0


def test_derive_expected_interval_falls_back_with_insufficient_history():
    interval = derive_expected_interval_minutes([datetime(2026, 1, 1)], fallback_minutes=60)
    assert interval == 60.0

    interval_empty = derive_expected_interval_minutes([], fallback_minutes=45)
    assert interval_empty == 45.0


def test_completeness_matches_worked_example():
    # 24 expected hourly records over a day, 22 received -> 22/24 = 0.9167
    start = datetime(2026, 1, 1, 0, 0)
    end = start + timedelta(hours=24)
    received = [start + timedelta(hours=i) for i in range(24) if i not in (5, 17)]

    completeness, expected, received_count = compute_completeness(
        received, start, end, expected_interval_minutes=60
    )

    assert expected == 24
    assert received_count == 22
    assert abs(completeness - 22 / 24) < 1e-9


def test_completeness_caps_at_one_when_over_received():
    start = datetime(2026, 1, 1)
    end = start + timedelta(hours=2)
    received = [start, start + timedelta(minutes=1), start + timedelta(minutes=2)]

    completeness, expected, received_count = compute_completeness(
        received, start, end, expected_interval_minutes=60
    )

    assert completeness == 1.0


def test_completeness_zero_when_nothing_received():
    start = datetime(2026, 1, 1)
    end = start + timedelta(hours=24)
    completeness, expected, received_count = compute_completeness(
        [], start, end, expected_interval_minutes=60
    )
    assert received_count == 0
    assert completeness == 0.0


def _run_all():
    tests = [v for k, v in globals().items() if k.startswith("test_") and callable(v)]
    for t in tests:
        t()
        print(f"PASS {t.__name__}")
    print(f"\n{len(tests)} completeness tests passed.")


if __name__ == "__main__":
    _run_all()
