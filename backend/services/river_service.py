import pandas as pd
from database.db_connection import get_engine

engine = get_engine()


def get_latest_river():

    query = """
    SELECT *
    FROM river_data
    WHERE "DateTime" = (
        SELECT MAX("DateTime")
        FROM river_data
    )
    ORDER BY "River", "Station";
    """

    df = pd.read_sql(query, engine)

    return df.to_dict(orient="records")


def get_river_history():

    query = """
    SELECT *
    FROM river_data
    ORDER BY "DateTime" DESC,
             "River",
             "Station";
    """

    df = pd.read_sql(query, engine)

    return df.to_dict(orient="records")