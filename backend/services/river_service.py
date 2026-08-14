import pandas as pd
from database.db_connection import get_engine, ensure_river_data_timestamp_column

engine = get_engine()
ensure_river_data_timestamp_column()


def get_latest_river():

    # Ordered by "ReportTimestamp" (a real TIMESTAMP), not the raw
    # "DateTime" text column - see ensure_river_data_timestamp_column()'s
    # docstring for why sorting on the text column picks the wrong report.
    query = """
    SELECT *
    FROM river_data
    WHERE "ReportTimestamp" = (
        SELECT MAX("ReportTimestamp")
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
    ORDER BY "ReportTimestamp" DESC,
             "River",
             "Station";
    """

    df = pd.read_sql(query, engine)

    return df.to_dict(orient="records")
