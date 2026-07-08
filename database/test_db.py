from sqlalchemy import text
from database.db_connection import get_engine

engine = get_engine()

with engine.connect() as conn:
    result = conn.execute(text("SELECT version();"))
    
    for row in result:
        print(row[0])