"""
Controlled data-degradation simulators for the research experiments (see
ML/run_reliability_experiments.py). Every function here is pure: it takes a
DataFrame, returns a NEW DataFrame, and never mutates its input or touches
disk/DB - so degraded copies can never leak back into the production
dataset or live tables.
"""

import numpy as np
import pandas as pd


def simulate_missing(df, pct, columns=None, random_state=42):
    """Return a copy of `df` with `pct` (0-100) of values in `columns`
    (default: all numeric columns) replaced with NaN, chosen uniformly at
    random. Models missing observations/gaps in the time series."""
    out = df.copy()
    if columns is None:
        columns = out.select_dtypes(include=[np.number]).columns.tolist()

    rng = np.random.default_rng(random_state)
    fraction = max(0.0, min(1.0, pct / 100.0))

    for col in columns:
        if col not in out.columns or fraction <= 0:
            continue
        mask = rng.random(len(out)) < fraction
        out.loc[mask, col] = np.nan

    return out


def simulate_delay(df, minutes, pct=100, delay_column="simulated_delay_minutes", random_state=42):
    """Return a copy of `df` with a `delay_column` added, recording a
    simulated arrival delay (in minutes) for `pct` (0-100) of rows chosen
    uniformly at random; the rest get 0. Does not alter any existing
    column - callers combine this with reliability.timeliness.compute_timeliness
    to turn it into a timeliness score."""
    out = df.copy()
    rng = np.random.default_rng(random_state)
    fraction = max(0.0, min(1.0, pct / 100.0))

    delays = np.zeros(len(out))
    mask = rng.random(len(out)) < fraction
    delays[mask] = minutes
    out[delay_column] = delays

    return out


def simulate_invalid(df, pct, columns=None, random_state=42):
    """Return a copy of `df` with `pct` (0-100) of values in `columns`
    (default: all numeric columns) replaced with out-of-range / corrupted
    values (large negative or absurdly large numbers), chosen uniformly at
    random. Models sensor faults / transmission corruption."""
    out = df.copy()
    if columns is None:
        columns = out.select_dtypes(include=[np.number]).columns.tolist()

    rng = np.random.default_rng(random_state)
    fraction = max(0.0, min(1.0, pct / 100.0))

    for col in columns:
        if col not in out.columns or fraction <= 0:
            continue
        mask = rng.random(len(out)) < fraction
        n_corrupt = int(mask.sum())
        if n_corrupt == 0:
            continue
        # Half negative (impossible), half absurdly large (out-of-range).
        corrupt_values = np.where(
            rng.random(n_corrupt) < 0.5,
            -abs(rng.uniform(1, 1000, n_corrupt)),
            rng.uniform(1e4, 1e6, n_corrupt),
        )
        out.loc[mask, col] = corrupt_values

    return out


CONDITIONS = {
    "normal": lambda df: df.copy(),
    "missing_10": lambda df: simulate_missing(df, 10),
    "missing_20": lambda df: simulate_missing(df, 20),
    "missing_30": lambda df: simulate_missing(df, 30),
    "delayed": lambda df: simulate_delay(df, minutes=240, pct=50),
    "invalid": lambda df: simulate_invalid(df, 10),
}


def apply_condition(df, condition_name):
    """Look up and apply one of the named CONDITIONS. Raises KeyError for
    an unknown condition name."""
    return CONDITIONS[condition_name](df)
