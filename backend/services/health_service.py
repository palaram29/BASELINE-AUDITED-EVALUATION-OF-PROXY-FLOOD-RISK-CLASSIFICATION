import os
import pandas as pd
from database.db_connection import get_engine

engine = get_engine()


def check_health():

    health = {
        "api": "Running",
        "database": "Disconnected",
        "ml_model": "Missing"
    }

    try:

        pd.read_sql("SELECT 1", engine)

        health["database"] = "Connected"

    except Exception:

        pass

    if os.path.exists("ML_Training/flood_prediction_model.pkl"):

        health["ml_model"] = "Available"

    return health