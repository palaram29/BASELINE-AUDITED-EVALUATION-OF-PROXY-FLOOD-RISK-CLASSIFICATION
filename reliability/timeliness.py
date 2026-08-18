"""
Timeliness scoring: how close a record's actual arrival time is to its
expected arrival time, converted to a normalized 0-1 score via configurable
acceptable/max delay thresholds (reliability/config.py).
"""

from . import config as cfg


def compute_timeliness(
    actual_arrival,
    expected_arrival,
    acceptable_delay_minutes=None,
    max_delay_minutes=None,
):
    """1.0 if the record arrived within the acceptable delay (including
    early), linearly falling to 0.0 at max_delay_minutes, 0.0 beyond that
    or if either timestamp is missing.
    """
    if acceptable_delay_minutes is None:
        acceptable_delay_minutes = cfg.TIMELINESS_ACCEPTABLE_DELAY_MINUTES
    if max_delay_minutes is None:
        max_delay_minutes = cfg.TIMELINESS_MAX_DELAY_MINUTES

    if actual_arrival is None or expected_arrival is None:
        return 0.0

    delay_minutes = (actual_arrival - expected_arrival).total_seconds() / 60.0

    if delay_minutes <= acceptable_delay_minutes:
        return 1.0
    if delay_minutes >= max_delay_minutes:
        return 0.0

    span = max_delay_minutes - acceptable_delay_minutes
    if span <= 0:
        return 0.0

    score = 1.0 - (delay_minutes - acceptable_delay_minutes) / span
    return max(0.0, min(1.0, score))
