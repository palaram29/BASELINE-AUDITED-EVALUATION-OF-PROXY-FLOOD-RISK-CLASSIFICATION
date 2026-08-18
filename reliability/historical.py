"""
Historical reliability: a per-source score that updates as new data arrives,
built only from the source's OWN past composite reliability scores - never
from the current observation being scored (that would be circular/leaky).
"""

from . import config as cfg


def compute_historical_reliability(previous_scores, method=None, alpha=None, lookback=None):
    """`previous_scores` is a chronologically ordered iterable of a source's
    past `reliability_score` values (oldest first), NOT including the
    observation currently being scored.

    method="ema" (default): exponential moving average, seeded with
    config.HISTORICAL_RELIABILITY_DEFAULT when there's no history yet.
    method="average": simple mean of the last `lookback` scores.
    """
    method = method or cfg.HISTORICAL_RELIABILITY_METHOD
    alpha = cfg.HISTORICAL_RELIABILITY_EMA_ALPHA if alpha is None else alpha
    lookback = cfg.HISTORICAL_RELIABILITY_LOOKBACK if lookback is None else lookback

    scores = [s for s in (previous_scores or []) if s is not None]
    if not scores:
        return cfg.HISTORICAL_RELIABILITY_DEFAULT

    if method == "average":
        window = scores[-lookback:]
        return sum(window) / len(window)

    # EMA (default)
    h = cfg.HISTORICAL_RELIABILITY_DEFAULT
    for score in scores:
        h = alpha * score + (1 - alpha) * h
    return h
