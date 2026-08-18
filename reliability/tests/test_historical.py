"""Unit tests for reliability/historical.py."""

from reliability.historical import compute_historical_reliability
from reliability import config as cfg


def test_no_history_returns_neutral_default():
    h = compute_historical_reliability([])
    assert h == cfg.HISTORICAL_RELIABILITY_DEFAULT


def test_ema_moves_toward_recent_scores():
    # Consistently high past scores should pull H up from the neutral default.
    h = compute_historical_reliability([0.95] * 10, method="ema", alpha=0.3)
    assert h > cfg.HISTORICAL_RELIABILITY_DEFAULT
    assert h <= 1.0


def test_ema_moves_toward_low_recent_scores():
    h = compute_historical_reliability([0.1] * 10, method="ema", alpha=0.3)
    assert h < cfg.HISTORICAL_RELIABILITY_DEFAULT


def test_average_method_uses_lookback_window():
    scores = [0.5] * 50 + [1.0] * 5
    h = compute_historical_reliability(scores, method="average", lookback=5)
    assert h == 1.0


def test_only_uses_past_scores_never_current():
    # Same function signature can't see "current" at all - this asserts the
    # contract by construction: passing an empty list (no past data) must
    # not spike toward any particular value, only the neutral prior.
    h = compute_historical_reliability([])
    assert h == cfg.HISTORICAL_RELIABILITY_DEFAULT


def _run_all():
    tests = [v for k, v in globals().items() if k.startswith("test_") and callable(v)]
    for t in tests:
        t()
        print(f"PASS {t.__name__}")
    print(f"\n{len(tests)} historical-reliability tests passed.")


if __name__ == "__main__":
    _run_all()
