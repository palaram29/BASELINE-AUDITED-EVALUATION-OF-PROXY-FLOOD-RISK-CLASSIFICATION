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
    """Idempotently add the Probability/Model_Used columns used by the
    ML dashboard's live prediction and prediction-history features.
    Safe to call on every startup - existing rows just get NULLs until
    the next prediction run touches them."""

    with engine.begin() as conn:
        conn.execute(text(
            'ALTER TABLE prediction_results '
            'ADD COLUMN IF NOT EXISTS "Probability" DOUBLE PRECISION'
        ))
        conn.execute(text(
            'ALTER TABLE prediction_results '
            'ADD COLUMN IF NOT EXISTS "Model_Used" TEXT'
        ))