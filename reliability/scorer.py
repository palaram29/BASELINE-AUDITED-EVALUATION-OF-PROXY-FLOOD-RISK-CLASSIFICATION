"""
Overall reliability scoring: combines Completeness, Timeliness, Validity and
Historical Reliability into the final weighted score and HIGH/MEDIUM/LOW
classification.

    R = w1*C + w2*T + w3*V + w4*H
"""

from . import config as cfg


def classify(reliability_score, high_threshold=None, medium_threshold=None):
    high_threshold = cfg.RELIABILITY_HIGH_THRESHOLD if high_threshold is None else high_threshold
    medium_threshold = (
        cfg.RELIABILITY_MEDIUM_THRESHOLD if medium_threshold is None else medium_threshold
    )

    if reliability_score >= high_threshold:
        return "HIGH"
    if reliability_score >= medium_threshold:
        return "MEDIUM"
    return "LOW"


def compute_reliability(
    completeness,
    timeliness,
    validity,
    historical,
    weights=None,
):
    """Combine the four 0-1 components into the final weighted reliability
    score + HIGH/MEDIUM/LOW level.

    `weights` optionally overrides the configured (w1, w2, w3, w4) tuple for
    experimentation - see reliability/config.py for the default (equal,
    0.25 each).
    """
    if weights is None:
        w1 = cfg.RELIABILITY_WEIGHT_COMPLETENESS
        w2 = cfg.RELIABILITY_WEIGHT_TIMELINESS
        w3 = cfg.RELIABILITY_WEIGHT_VALIDITY
        w4 = cfg.RELIABILITY_WEIGHT_HISTORICAL
    else:
        w1, w2, w3, w4 = weights

    completeness = max(0.0, min(1.0, completeness))
    timeliness = max(0.0, min(1.0, timeliness))
    validity = max(0.0, min(1.0, validity))
    historical = max(0.0, min(1.0, historical))

    reliability_score = w1 * completeness + w2 * timeliness + w3 * validity + w4 * historical
    reliability_score = max(0.0, min(1.0, reliability_score))

    return {
        "completeness_score": completeness,
        "timeliness_score": timeliness,
        "validity_score": validity,
        "historical_reliability_score": historical,
        "reliability_score": reliability_score,
        "reliability_level": classify(reliability_score),
    }
