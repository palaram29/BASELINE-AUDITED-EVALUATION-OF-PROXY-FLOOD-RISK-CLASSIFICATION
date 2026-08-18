"""
Service layer for the Data Source Reliability layer.

Reads weather_data/river_data, scores each source (one row per City for
weather, one per (River, Station) pair for river) through reliability/
(pure logic, DB-free), and persists the result into data_reliability /
data_validation_log (see database.db_connection.ensure_data_reliability_tables).

Distinct from backend/services/mlops_service.py::compute_data_quality_metrics
- that's a simpler, aggregate missing-rate x city-coverage number that
predates this layer (stored under metric_name="data_reliability_score" in
ml_monitoring_metrics, surfaced via GET /mlops/data-quality) and is left
untouched. This module is the per-source, four-component (Completeness,
Timeliness, Validity, Historical) weighted layer, surfaced via GET
/reliability and consumed by backend/generate_ml_features.py.

Timeliness is measured the same way for both source types: "how overdue is
a fresher record than the latest one we have, given this source's own
observed collection cadence?" - expected_arrival = latest_timestamp +
expected_interval, actual_arrival = the time being scored (as_of). This
avoids needing a separately-stored ingestion timestamp for weather_data
(which only has a date-granularity "Date" column) while still using a
genuinely real timestamp for river_data (its "ReportTimestamp" column).
"""

import json
from datetime import datetime, timedelta, timezone

import pandas as pd
from sqlalchemy import text

from database.db_connection import get_engine
from backend.utils.logger import logger
from backend.config import CITIES

from reliability import config as rcfg
from reliability.completeness import compute_completeness, derive_expected_interval_minutes
from reliability.timeliness import compute_timeliness
from reliability.validity import validate_batch
from reliability.historical import compute_historical_reliability
from reliability.scorer import compute_reliability

engine = get_engine()


class ReliabilityError(Exception):
    """Raised for reliability-layer errors the route layer should turn into
    an HTTP error (unknown source, no data at all yet, etc.)."""


# =====================================================
# CITY <-> RIVER STATION MAPPING
# =====================================================
# Deliberately partial, best-effort geography (not a surveyed gazetteer) -
# same caveat status as ML/utils.py's COASTAL_MAP. river_data has 39
# (River, Station) pairs with no City column at all, so this is the only
# way to attach a River_Reliability figure to a City-level ML feature row.
# Cities left out fall back to the network-wide average river reliability
# in resolve_river_source_for_city() below, rather than a guessed mapping.
CITY_TO_RIVER_STATION_MAP = {
    "Colombo": ("Kelani Ganga", "Hanwella"),
    "Kolonnawa": ("Kelani Ganga", "Hanwella"),
    "Sri Jayewardenepura Kotte": ("Kelani Ganga", "Hanwella"),
    "Athurugiriya": ("Kelani Ganga", "Hanwella"),
    "Oruwala": ("Kelani Ganga", "Hanwella"),
    "Ratnapura": ("Kalu Ganga", "Rathnapura"),
    "Kalutara": ("Kalu Ganga", "Ellagawa"),
    "Kandy": ("Mahaweli Ganga", "Peradeniya"),
    "Galle": ("Gin Ganga", "Baddegama"),
    "Matara": ("Nilwala Ganga", "Thalgahagoda"),
    "Weligama": ("Nilwala Ganga", "Panadugama"),
    "Badulla": ("Badulu Oya", "Thaldena"),
    "Hambantota": ("Kirindi Oya", "Thanamalwila"),
    "Kurunegala": ("Mee Oya", "Galgamuwa"),
    "Pothuhera": ("Deduru Oya", "Moragaswewa"),
    "Puttalam": ("Deduru Oya", "Moragaswewa"),
    "Gampaha": ("Attanagalu Oya", "Dunamale"),
    "Negombo": ("Attanagalu Oya", "Dunamale"),
    "Mannar": ("Malwathu Oya", "Thanthirimale"),
    "Trincomalee": ("Yan Oya", "Horowpothana"),
    "Hatton": ("Kehelgamu Oya", "Norwood"),
}


def resolve_river_source_for_city(city):
    """(River, Station) tuple for `city`, or None if unmapped - callers
    should fall back to the network-wide average river reliability."""
    return CITY_TO_RIVER_STATION_MAP.get(city)


def _source_key(river, station):
    return f"{river}:{station}"


# =====================================================
# PERSISTENCE HELPERS
# =====================================================

def _get_previous_scores(source, limit=None):
    limit = limit or rcfg.HISTORICAL_RELIABILITY_LOOKBACK
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT reliability_score FROM data_reliability
                WHERE source = :source
                ORDER BY computed_at DESC
                LIMIT :limit
                """
            ),
            {"source": source, "limit": limit},
        ).mappings().all()
    # Oldest-first, as compute_historical_reliability expects.
    return [r["reliability_score"] for r in reversed(rows)]


def _persist_reliability(source_type, source, timestamp, result):
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO data_reliability (
                    source_type, source, timestamp,
                    completeness_score, timeliness_score, validity_score,
                    historical_reliability_score, reliability_score, reliability_level
                ) VALUES (
                    :source_type, :source, :timestamp,
                    :completeness_score, :timeliness_score, :validity_score,
                    :historical_reliability_score, :reliability_score, :reliability_level
                )
                """
            ),
            {
                "source_type": source_type,
                "source": source,
                "timestamp": timestamp,
                **result,
            },
        )


def _persist_validation_flags(source_type, source, df, flags):
    if not flags:
        return
    with engine.begin() as conn:
        for f in flags:
            record_ts = None
            row_index = f.get("row_index")
            if row_index is not None and row_index in df.index:
                for ts_col in ("Date", "ReportTimestamp"):
                    if ts_col in df.columns:
                        record_ts = df.loc[row_index, ts_col]
                        break
            conn.execute(
                text(
                    """
                    INSERT INTO data_validation_log (
                        source_type, source, record_timestamp, field_name,
                        observed_value, issue_type, is_suspicious
                    ) VALUES (
                        :source_type, :source, :record_timestamp, :field_name,
                        :observed_value, :issue_type, TRUE
                    )
                    """
                ),
                {
                    "source_type": source_type,
                    "source": source,
                    "record_timestamp": pd.Timestamp(record_ts) if pd.notna(record_ts) else None,
                    "field_name": f["field_name"],
                    "observed_value": None if f["observed_value"] is None else str(f["observed_value"]),
                    "issue_type": f["issue_type"],
                },
            )


def _score_source(source_type, source, timestamps, validity_df, column_map, duplicate_key_cols, timestamp_col, as_of):
    """Shared scoring pipeline: completeness + timeliness + validity +
    historical -> combined reliability_score/level. Persists the result and
    any validation flags. Returns the full result dict, or None if there is
    no data at all for this source yet (nothing to score)."""

    if not timestamps:
        logger.warning(f"Reliability: no data yet for {source_type} source '{source}', skipping.")
        return None

    window_end = as_of
    window_start = window_end - timedelta(days=rcfg.COMPLETENESS_WINDOW_DAYS)
    completeness, expected_count, received_count = compute_completeness(
        timestamps, window_start, window_end, history_timestamps=timestamps
    )

    expected_interval = derive_expected_interval_minutes(timestamps)
    latest_timestamp = max(timestamps)
    expected_arrival = latest_timestamp + timedelta(minutes=expected_interval)
    timeliness = compute_timeliness(as_of, expected_arrival)

    validity_score, flagged_df, flags = validate_batch(
        validity_df, column_map, timestamp_col=timestamp_col, duplicate_key_cols=duplicate_key_cols
    )

    previous_scores = _get_previous_scores(source)
    historical = compute_historical_reliability(previous_scores)

    result = compute_reliability(completeness, timeliness, validity_score, historical)

    _persist_reliability(source_type, source, latest_timestamp, result)
    _persist_validation_flags(source_type, source, flagged_df, flags)

    if result["reliability_score"] < rcfg.RELIABILITY_ALERT_THRESHOLD:
        record_reliability_alert(source_type, source, result)

    result.update(
        {
            "source_type": source_type,
            "source": source,
            "timestamp": latest_timestamp,
            "expected_records": expected_count,
            "received_records": received_count,
        }
    )
    return result


# =====================================================
# COMPUTE (called by backend/generate_ml_features.py and the scheduler)
# =====================================================

def compute_weather_reliability(city, as_of=None):
    as_of = as_of or datetime.utcnow()

    df = pd.read_sql(
        text('SELECT * FROM weather_data WHERE "City" = :city ORDER BY "Date"'),
        engine,
        params={"city": city},
    )
    if df.empty:
        return _score_source("weather", city, [], df, {}, None, None, as_of)

    df["Date"] = pd.to_datetime(df["Date"])
    timestamps = list(df["Date"])

    return _score_source(
        source_type="weather",
        source=city,
        timestamps=timestamps,
        validity_df=df,
        column_map={"rainfall": "Rainfall", "temperature": "Temperature", "windspeed": "WindSpeed"},
        duplicate_key_cols=["Date", "City"],
        timestamp_col="Date",
        as_of=as_of,
    )


def compute_river_reliability(river, station, as_of=None):
    as_of = as_of or datetime.utcnow()
    source = _source_key(river, station)

    df = pd.read_sql(
        text(
            'SELECT * FROM river_data WHERE "River" = :river AND "Station" = :station '
            'ORDER BY "ReportTimestamp"'
        ),
        engine,
        params={"river": river, "station": station},
    )
    if df.empty or df["ReportTimestamp"].isna().all():
        return _score_source("river", source, [], df, {}, None, None, as_of)

    df = df[df["ReportTimestamp"].notna()].reset_index(drop=True)
    timestamps = list(pd.to_datetime(df["ReportTimestamp"]))

    column_map = {"river_level": "WaterLevel"}
    if "Rainfall" in df.columns:
        column_map["rainfall"] = "Rainfall"

    return _score_source(
        source_type="river",
        source=source,
        timestamps=timestamps,
        validity_df=df,
        column_map=column_map,
        duplicate_key_cols=["River", "Station", "ReportTimestamp"],
        timestamp_col="ReportTimestamp",
        as_of=as_of,
    )


def compute_all_river_source_reliability(as_of=None):
    """Score every distinct (River, Station) pair present in river_data and
    return {(river, station): result}. Used by
    backend/generate_ml_features.py to compute both the mapped
    River_Reliability for a city and the network-wide average fallback for
    unmapped cities in a single pass, instead of recomputing per city."""

    as_of = as_of or datetime.utcnow()
    scores = {}
    for river, station in get_all_river_sources():
        try:
            result = compute_river_reliability(river, station, as_of=as_of)
            if result:
                scores[(river, station)] = result
        except Exception as exc:
            logger.error(f"Reliability: river scoring failed for '{river}:{station}': {exc}")
    return scores


def get_all_river_sources():
    with engine.connect() as conn:
        rows = conn.execute(
            text('SELECT DISTINCT "River", "Station" FROM river_data ORDER BY "River", "Station"')
        ).mappings().all()
    return [(r["River"], r["Station"]) for r in rows]


def compute_all_reliability(as_of=None):
    """Score every weather source (one per City) and every river source
    (one per (River, Station) pair actually present in river_data). Called
    from backend/scheduler.py after each successful pipeline run, same
    place mlops_service.run_monitoring_cycle() is invoked from."""

    as_of = as_of or datetime.utcnow()
    results = []

    for city in CITIES:
        try:
            result = compute_weather_reliability(city, as_of=as_of)
            if result:
                results.append(result)
        except Exception as exc:
            logger.error(f"Reliability: weather scoring failed for '{city}': {exc}")

    try:
        river_sources = get_all_river_sources()
    except Exception as exc:
        logger.error(f"Reliability: could not list river sources: {exc}")
        river_sources = []

    for river, station in river_sources:
        try:
            result = compute_river_reliability(river, station, as_of=as_of)
            if result:
                results.append(result)
        except Exception as exc:
            logger.error(f"Reliability: river scoring failed for '{river}:{station}': {exc}")

    logger.info(f"Reliability: scored {len(results)} sources ({as_of.isoformat()}).")
    return results


# =====================================================
# ALERTING (feeds MLOps monitoring)
# =====================================================

def record_reliability_alert(source_type, source, result):
    """Low-reliability breach -> logged into the existing
    ml_monitoring_metrics table (reusing its shape rather than inventing a
    parallel alerts mechanism) so it's picked up wherever that table is
    already surfaced (GET /mlops/*). See §16 of the integration spec."""

    status = "CRITICAL" if result["reliability_level"] == "LOW" else "WARNING"
    metric_name = f"data_source_reliability:{source_type}:{source}"

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO ml_monitoring_metrics (metric_name, metric_value, status, details_json)
                VALUES (:metric_name, :metric_value, :status, :details_json)
                """
            ),
            {
                "metric_name": metric_name,
                "metric_value": result["reliability_score"],
                "status": status,
                "details_json": json.dumps(
                    {
                        "reliability_level": result["reliability_level"],
                        "completeness_score": result["completeness_score"],
                        "timeliness_score": result["timeliness_score"],
                        "validity_score": result["validity_score"],
                        "historical_reliability_score": result["historical_reliability_score"],
                    }
                ),
            },
        )

    logger.warning(
        f"LOW DATA RELIABILITY WARNING: {source_type}:{source} "
        f"score={result['reliability_score']:.3f} level={result['reliability_level']}"
    )


# =====================================================
# READ API (backend/routes/reliability.py)
# =====================================================

def get_source_reliability(source_type=None):
    """Latest scored row per source, optionally filtered by source_type
    ('weather' | 'river')."""

    query = """
        SELECT DISTINCT ON (source) *
        FROM data_reliability
        {where}
        ORDER BY source, computed_at DESC
    """.format(where='WHERE source_type = :source_type' if source_type else "")

    params = {"source_type": source_type} if source_type else {}
    with engine.connect() as conn:
        rows = conn.execute(text(query), params).mappings().all()

    return [dict(r) for r in rows]


def get_overall_reliability():
    sources = get_source_reliability()
    if not sources:
        raise ReliabilityError(
            "No reliability data yet - run the pipeline "
            "(POST /system/run-pipeline) or wait for the scheduler."
        )

    from reliability.scorer import classify

    overall_score = sum(s["reliability_score"] for s in sources) / len(sources)
    return {
        "overall_score": round(overall_score, 4),
        "overall_level": classify(overall_score),
        "source_count": len(sources),
        "computed_at": max(s["computed_at"] for s in sources),
    }


def get_reliability_summary():
    """Compact shape for the main Dashboard's Data Reliability widget:
    overall + a per-source-type (weather/river) rollup."""

    from reliability.scorer import classify

    sources = get_source_reliability()
    if not sources:
        raise ReliabilityError(
            "No reliability data yet - run the pipeline "
            "(POST /system/run-pipeline) or wait for the scheduler."
        )

    overall_score = sum(s["reliability_score"] for s in sources) / len(sources)

    def _rollup(source_type):
        subset = [s for s in sources if s["source_type"] == source_type]
        if not subset:
            return None
        score = sum(s["reliability_score"] for s in subset) / len(subset)
        return {"score": round(score, 4), "level": classify(score), "source_count": len(subset)}

    return {
        "overall_score": round(overall_score, 4),
        "overall_level": classify(overall_score),
        "weather": _rollup("weather"),
        "river": _rollup("river"),
        "computed_at": max(s["computed_at"] for s in sources),
    }


def get_reliability_history(source, days=30):
    cutoff = datetime.utcnow() - timedelta(days=days)
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT * FROM data_reliability
                WHERE source = :source AND computed_at >= :cutoff
                ORDER BY computed_at
                """
            ),
            {"source": source, "cutoff": cutoff},
        ).mappings().all()
    return [dict(r) for r in rows]


def get_recent_validation_flags(source=None, limit=50):
    query = """
        SELECT * FROM data_validation_log
        {where}
        ORDER BY created_at DESC
        LIMIT :limit
    """.format(where="WHERE source = :source" if source else "")
    params = {"limit": limit}
    if source:
        params["source"] = source
    with engine.connect() as conn:
        rows = conn.execute(text(query), params).mappings().all()
    return [dict(r) for r in rows]
