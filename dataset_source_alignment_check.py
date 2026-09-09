"""
Dataset provenance / source-alignment check (supervisor review, 9 Sep).

The review's actual concern: historical training data (Kaggle-sourced,
provenance undocumented per the paper's own construct-validity
discussion) and the live WeatherAPI feed are two different sources with
no guaranteed relationship. There is no literal date overlap to check
(training data ends 2023, live data starts 2026), so a true "same-day"
comparison is impossible. This script instead runs the check that IS
possible: compare the live feed's rainfall distribution for a given
calendar window (e.g. the first two weeks of September) against the
historical distribution for that SAME calendar window across all
training years, as a sanity check that the two sources are at least
plausibly measuring the same kind of quantity - not proof they are
interchangeable, just a check that they are not glaringly incompatible
in scale (which they were, before the September fix to
weather_collector.py, when live rainfall averaged ~2mm against a
~17.85mm historical average).

Requires a live database connection - this script must be run on your
machine against your real weather_data table, not in the sandbox that
built it, since the sandbox does not have your Postgres instance or the
several weeks of live collector history this check needs to be
meaningful with only a handful of days.

Usage:
    python dataset_source_alignment_check.py --month 9 --day-start 1 --day-end 30
"""

import argparse
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from sqlalchemy import text

from database.db_connection import get_engine
from ML.utils import PROCESSED_DATASET_CSV

engine = get_engine()


def historical_distribution(month, day_start, day_end):
    df = pd.read_csv(PROCESSED_DATASET_CSV, parse_dates=["End_Date"])
    mask = (
        (df["End_Date"].dt.month == month)
        & (df["End_Date"].dt.day >= day_start)
        & (df["End_Date"].dt.day <= day_end)
    )
    return df.loc[mask, "Rainfall_3Day"]


def live_distribution(month, day_start, day_end):
    query = text(
        '''
        SELECT "Rainfall" FROM weather_data
        WHERE EXTRACT(MONTH FROM "Date") = :month
          AND EXTRACT(DAY FROM "Date") BETWEEN :day_start AND :day_end
        '''
    )
    with engine.connect() as conn:
        rows = conn.execute(query, {"month": month, "day_start": day_start, "day_end": day_end}).fetchall()
    return pd.Series([r[0] for r in rows], dtype=float)


def summarize(series, label):
    if series.empty:
        print(f"{label}: no rows found")
        return None
    stats = {
        "n": len(series),
        "mean": round(series.mean(), 3),
        "median": round(series.median(), 3),
        "p90": round(series.quantile(0.90), 3),
        "max": round(series.max(), 3),
    }
    print(f"{label}: n={stats['n']}  mean={stats['mean']}  median={stats['median']}  "
          f"p90={stats['p90']}  max={stats['max']}")
    return stats


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--month", type=int, required=True, help="Calendar month, 1-12")
    parser.add_argument("--day-start", type=int, default=1)
    parser.add_argument("--day-end", type=int, default=31)
    args = parser.parse_args()

    print(f"===== SOURCE ALIGNMENT CHECK: month={args.month}, days {args.day_start}-{args.day_end} =====\n")

    hist = historical_distribution(args.month, args.day_start, args.day_end)
    hist_stats = summarize(hist, "Historical (training data, all years, 3-day rolling sum)")

    live = live_distribution(args.month, args.day_start, args.day_end)
    live_stats = summarize(live, "Live (weather_data table, single-day reading)")

    if hist_stats and live_stats and live_stats["n"] > 0:
        ratio = live_stats["mean"] / hist_stats["mean"] if hist_stats["mean"] else float("nan")
        print(
            f"\nLive mean is {ratio:.2f}x the historical mean for this calendar window. "
            f"Note this compares a single-day live reading against a 3-day historical "
            f"rolling sum, so a ratio well below 1 is expected by construction, not "
            f"necessarily a mismatch - this check is a coarse plausibility screen, not "
            f"a formal equivalence test."
        )
    else:
        print(
            "\nNot enough live rows to compare yet - this check needs at least a couple "
            "of weeks of collector history under the corrected weather_collector.py "
            "before the comparison is meaningful."
        )


if __name__ == "__main__":
    main()
