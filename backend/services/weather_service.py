import pandas as pd
from database.db_connection import get_engine

engine = get_engine()


def get_latest_weather():

    query = """
    SELECT *
    FROM weather_data
    WHERE "Date" = (
        SELECT MAX("Date")
        FROM weather_data
    )
    ORDER BY "City";
    """

    df = pd.read_sql(query, engine)

    return df.to_dict(orient="records")


def get_weather_history():

    query = """
    SELECT *
    FROM weather_data
    ORDER BY "Date" DESC,
             "City";
    """

    df = pd.read_sql(query, engine)

    return df.to_dict(orient="records")