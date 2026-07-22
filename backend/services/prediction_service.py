import pandas as pd
from database.db_connection import get_engine

engine = get_engine()


def get_latest_predictions():

    query = """
    SELECT DISTINCT ON ("City") *
    FROM prediction_results
    WHERE "Date" = (
        SELECT MAX("Date")
        FROM prediction_results
    )
    ORDER BY "City", id DESC;
    """

    df = pd.read_sql(query, engine)

    return df.to_dict(orient="records")


def get_prediction_history():

    query = """
    SELECT *
    FROM prediction_results
    ORDER BY "Date" DESC,
             "City";
    """

    df = pd.read_sql(query, engine)

    return df.to_dict(orient="records")