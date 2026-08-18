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


def ensure_mlops_tables():
    """Idempotently create the MLOps monitoring/lifecycle tables. Safe to
    call on every startup.

    These tables are the read model the backend API/dashboard query -
    MLflow (see ML/train_models.py, ML/register_run.py) is the audit
    trail/artifact registry, but nothing in the live request path depends
    on MLflow being reachable; it only ever reads from here. See
    docs/MLOPS_INTEGRATION_PLAN.md.

    ml_model_versions.status lifecycle: Candidate -> Validation ->
    Production -> Archived. Promotion/rollback (backend/services/
    mlops_service.py::promote_model_version) is the only code path that
    changes a row to/from Production - always a deliberate, human-
    triggered action, never automatic (see
    docs/ML_METHODOLOGY_AND_LIMITATIONS.md "Production deployment: frozen
    model policy", which this preserves rather than replaces)."""

    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS ml_training_runs (
                id SERIAL PRIMARY KEY,
                mlflow_run_id TEXT,
                train_file TEXT,
                test_file TEXT,
                dataset_train_rows INTEGER,
                dataset_test_rows INTEGER,
                selection_metric TEXT,
                duration_sec DOUBLE PRECISION,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """
        ))
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS ml_model_versions (
                id SERIAL PRIMARY KEY,
                training_run_id INTEGER REFERENCES ml_training_runs(id),
                algorithm TEXT NOT NULL,
                version INTEGER NOT NULL,
                mlflow_run_id TEXT,
                status TEXT NOT NULL DEFAULT 'Candidate',
                artifact_path TEXT NOT NULL,
                accuracy DOUBLE PRECISION,
                macro_f1 DOUBLE PRECISION,
                high_risk_recall DOUBLE PRECISION,
                extreme_risk_recall DOUBLE PRECISION,
                roc_auc DOUBLE PRECISION,
                selection_reason TEXT,
                metrics_json TEXT,
                trained_at TIMESTAMP NOT NULL DEFAULT NOW(),
                promoted_at TIMESTAMP,
                UNIQUE (algorithm, version)
            )
            """
        ))
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS ml_drift_metrics (
                id SERIAL PRIMARY KEY,
                feature_name TEXT NOT NULL,
                psi_score DOUBLE PRECISION,
                status TEXT NOT NULL,
                window_days INTEGER NOT NULL,
                computed_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """
        ))
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS ml_prediction_monitoring (
                id SERIAL PRIMARY KEY,
                risk_level TEXT NOT NULL,
                count INTEGER NOT NULL,
                percentage DOUBLE PRECISION NOT NULL,
                window_days INTEGER NOT NULL,
                computed_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """
        ))
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS ml_monitoring_metrics (
                id SERIAL PRIMARY KEY,
                metric_name TEXT NOT NULL,
                metric_value DOUBLE PRECISION,
                status TEXT NOT NULL,
                details_json TEXT,
                computed_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """
        ))
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS ml_retraining_events (
                id SERIAL PRIMARY KEY,
                event_type TEXT NOT NULL,
                details_json TEXT,
                triggered_by TEXT NOT NULL DEFAULT 'system',
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """
        ))