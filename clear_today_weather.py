"""
One-off cleanup: deletes TODAY's rows from weather_data so
backend/weather_collector.py's dedup guard doesn't skip re-collection.

Only needed ONCE, right now, because today's rows were written by the OLD
collector code (instantaneous precip_mm) before the fix. After this,
tomorrow's row won't exist yet when the scheduler runs, so this problem
resolves itself going forward - do not run this as a recurring job.

Usage:
    python clear_today_weather.py
"""

import os
import sys
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from database.db_connection import get_engine

engine = get_engine()
today = datetime.now().strftime("%Y-%m-%d")


def main():
    with engine.connect() as conn:
        count = conn.execute(
            text('SELECT COUNT(*) FROM weather_data WHERE "Date" = :d'),
            {"d": today},
        ).scalar()

    print(f"Found {count} row(s) for {today} in weather_data.")

    if count == 0:
        print("Nothing to delete - you're already clear to re-run the collector.")
        return

    confirm = input(f"Delete these {count} row(s) so they can be re-collected with the fix? [y/N] ")
    if confirm.strip().lower() != "y":
        print("Cancelled - nothing deleted.")
        return

    with engine.begin() as conn:
        result = conn.execute(
            text('DELETE FROM weather_data WHERE "Date" = :d'),
            {"d": today},
        )
        print(f"Deleted {result.rowcount} row(s) for {today}.")

    print("\nNow run:  python backend/weather_collector.py")
    print("Colombo should come back close to the ~18mm shown in the raw WeatherAPI response, not 0.33mm.")


if __name__ == "__main__":
    main()
