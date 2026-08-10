import os
import pandas as pd
from database.db_connection import get_engine
from backend.config import MODEL_FILE

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

    if os.path.exists(MODEL_FILE):

        health["ml_model"] = "Available"

    return health