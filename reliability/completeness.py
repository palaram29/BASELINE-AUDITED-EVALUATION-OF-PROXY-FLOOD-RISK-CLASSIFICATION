"""
Completeness scoring: expected-vs-received record counts over a rolling
window, with the expected collection cadence derived from actual historical
timestamp gaps rather than a hard-coded record count (per the research
requirement that completeness must reflect the source's real collection
frequency, not an assumed one).
"""

from . import config as cfg


def derive_expected_interval_minutes(timestamps, fallback_minutes=None):
    """Median gap (minutes) between consecutive sorted timestamps.

    Falls back to `fallback_minutes` (default: the pipeline's own run
    cadence, see config.DEFAULT_COLLECTION_INTERVAL_MINUTES) when there are
    fewer than two timestamps to derive a gap from.
    """
    if fallback_minutes is None:
        fallback_minutes = cfg.DEFAULT_COLLECTION_INTERVAL_MINUTES

    ts = sorted(t for t in timestamps if t is not None)
    if len(ts) < 2:
        return float(fallback_minutes)

    gaps = [
        (ts[i + 1] - ts[i]).total_seconds() / 60.0
        for i in range(len(ts) - 1)
    ]
    gaps = [g for g in gaps if g > 0]
    if not gaps:
        return float(fallback_minutes)

    gaps.sort()
    n = len(gaps)
    median = gaps[n // 2] if n % 2 else (gaps[n // 2 - 1] + gaps[n // 2]) / 2.0
    return median if median > 0 else float(fallback_minutes)


def compute_completeness(
    received_timestamps,
    window_start,
    window_end,
    expected_interval_minutes=None,
    history_timestamps=None,
    fallback_interval_minutes=None,
):
    """Completeness = min(received / expected, 1.0) over [window_start, window_end].

    `expected_interval_minutes`, if not given, is derived from
    `history_timestamps` (falling back to `received_timestamps` if no
    separate history is supplied) via `derive_expected_interval_minutes`.

    Returns (completeness_score, expected_count, received_count).
    """
    received_timestamps = list(received_timestamps or [])

    if expected_interval_minutes is None:
        basis = history_timestamps if history_timestamps else received_timestamps
        expected_interval_minutes = derive_expected_interval_minutes(
            basis, fallback_interval_minutes
        )

    window_minutes = (window_end - window_start).total_seconds() / 60.0
    expected_count = max(1, round(window_minutes / expected_interval_minutes))

    received_count = sum(
        1 for t in received_timestamps if t is not None and window_start <= t <= window_end
    )

    completeness = min(received_count / expected_count, 1.0) if expected_count else 1.0
    return completeness, expected_count, received_count
