"""Unit tests for reliability/scorer.py."""

from reliability.scorer import compute_reliability, classify


def test_equal_weights_average_worked_example():
    result = compute_reliability(
        completeness=0.917, timeliness=0.91, validity=0.98, historical=0.93
    )
    expected = 0.25 * (0.917 + 0.91 + 0.98 + 0.93)
    assert abs(result["reliability_score"] - expected) < 1e-9
    assert result["reliability_level"] == "HIGH"


def test_classification_boundaries():
    assert classify(1.0) == "HIGH"
    assert classify(0.80) == "HIGH"
    assert classify(0.79) == "MEDIUM"
    assert classify(0.60) == "MEDIUM"
    assert classify(0.59) == "LOW"
    assert classify(0.0) == "LOW"


def test_all_perfect_components_scores_one_high():
    result = compute_reliability(1.0, 1.0, 1.0, 1.0)
    assert result["reliability_score"] == 1.0
    assert result["reliability_level"] == "HIGH"


def test_all_zero_components_scores_zero_low():
    result = compute_reliability(0.0, 0.0, 0.0, 0.0)
    assert result["reliability_score"] == 0.0
    assert result["reliability_level"] == "LOW"


def test_custom_weights_override_default():
    # All weight on completeness only.
    result = compute_reliability(
        completeness=0.5, timeliness=0.0, validity=0.0, historical=0.0,
        weights=(1.0, 0.0, 0.0, 0.0),
    )
    assert result["reliability_score"] == 0.5


def test_components_are_clamped_to_0_1():
    result = compute_reliability(completeness=1.5, timeliness=-0.5, validity=0.5, historical=0.5)
    assert result["completeness_score"] == 1.0
    assert result["timeliness_score"] == 0.0


def _run_all():
    tests = [v for k, v in globals().items() if k.startswith("test_") and callable(v)]
    for t in tests:
        t()
        print(f"PASS {t.__name__}")
    print(f"\n{len(tests)} scorer tests passed.")


if __name__ == "__main__":
    _run_all()
