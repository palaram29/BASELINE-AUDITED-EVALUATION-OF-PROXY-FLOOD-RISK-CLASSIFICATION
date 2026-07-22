from database.db_connection import get_engine
from sqlalchemy import text

engine = get_engine()
with engine.begin() as conn:
    conn.execute(text('''
        DELETE FROM prediction_results
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       row_number() OVER (
                           PARTITION BY "Date", "City"
                           ORDER BY id DESC
                       ) AS rn
                FROM prediction_results
            ) AS ranked
            WHERE rn > 1
        )
    '''))
    conn.execute(text('''
        CREATE UNIQUE INDEX IF NOT EXISTS uq_prediction_results_date_city
        ON prediction_results ("Date", "City")
    '''))
print('duplicate cleanup complete')
