from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

DATABASE_URL = (
    f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# Create database engine
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)

def get_engine():
    return engine


def ensure_prediction_result_columns():
    """Idempotently add the Probability/Model_Used/Predicted_For_Date
    columns used by the ML dashboard's live prediction and
    prediction-history features. Safe to call on every startup - existing
    rows just get NULLs until the next prediction run touches them.

    Predicted_For_Date: the model now forecasts the day AFTER "Date"
    (see docs/ML_METHODOLOGY_AND_LIMITATIONS.md) - this column makes that
    explicit in stored rows and in the dashboard/API, instead of "Date"
    silently doubling as both "when this was computed" and "what day the
    risk applies to"."""

    with engine.begin() as conn:
        conn.execute(text(
            'ALTER TABLE prediction_results '
            'ADD COLUMN IF NOT EXISTS "Probability" DOUBLE PRECISION'
        ))
        conn.execute(text(
            'ALTER TABLE prediction_results '
            'ADD COLUMN IF NOT EXISTS "Model_Used" TEXT'
        ))
        conn.execute(text(
            'ALTER TABLE prediction_results '
            'ADD COLUMN IF NOT EXISTS "Predicted_For_Date" DATE'
        ))


def ensure_users_table():
    """Idempotently create the users table backing registration/login and
    per-user flood alerts. Safe to call on every startup."""

    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                phone TEXT,
                password_hash TEXT NOT NULL,
                alert_city TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """
        ))


def ensure_river_data_timestamp_column():
    """Idempotently add a real TIMESTAMP column derived from river_data's
    "DateTime" text field (e.g. "13-Aug-2026 12:30 PM", from the DMC PDF).

    Bug this fixes: "DateTime" is stored as free text, and get_latest_river()
    used to pick the report via MAX("DateTime") - a LEXICOGRAPHIC string
    comparison, not a chronological one. Since the DMC format doesn't
    zero-pad the day ("6-Aug-2026" not "06-Aug-2026"), "6-Aug-2026 3:30 PM"
    sorts AFTER "13-Aug-2026 12:30 PM" as a string (because the character
    '6' > '1'), so a genuinely week-old report was being served as "latest"
    - including a real "Alert" status that had long since cleared, which is
    exactly the false alert this was causing.

    "ReportTimestamp" is backfilled (and re-backfilled on every startup,
    which is cheap and only touches rows where it's still NULL) by parsing
    the existing "DateTime" text server-side, so this is safe to run
    against a table that already has historical rows."""

    with engine.begin() as conn:
        conn.execute(text(
            'ALTER TABLE river_data '
            'ADD COLUMN IF NOT EXISTS "ReportTimestamp" TIMESTAMP'
        ))
        conn.execute(text(
            """
            UPDATE river_data
            SET "ReportTimestamp" = to_timestamp("DateTime", 'FMDD-Mon-YYYY FMHH12:MI AM')
            WHERE "ReportTimestamp" IS NULL
            """
        ))