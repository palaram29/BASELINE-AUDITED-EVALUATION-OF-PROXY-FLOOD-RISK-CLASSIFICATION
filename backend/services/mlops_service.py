"""
Service layer for the MLOps monitoring/lifecycle layer - see
docs/MLOPS.md.

Reads/writes the 6 ml_* tables created by
database.db_connection.ensure_mlops_tables(). This is the read model the
API/dashboard query; MLflow (ML/train_models.py, ML/register_run.py) is
the audit trail/artifact registry, but nothing here depends on MLflow
being reachable at request time - every function below degrades
gracefully (empty/None results, never a raised error the caller didn't
already handle) if MLflow, a table, or a snapshot doesn't exist yet.

Retraining is never triggered automatically from here. Drift/quality
threshold breaches only ever produce a logged ml_retraining_events row
("drift_alert"/"quality_alert") - a human still runs
`python ML/train_models.py` and reviews the result, exactly as
docs/ML_METHODOLOGY_AND_LIMITATIONS.md's frozen-model policy (§18)
already requires. promote_model_version() is the only function that ever
changes what the live app serves, and it's always called by a human
action (POST /mlops/models/{id}/promote), never by the monitoring job.
"""

import os
import json
import math
import shutil
from datetime import datetime, timedelta, timezone

import pandas as pd
from sqlalchemy import text

from database.db_connection import get_engine
from backend.utils.logger import logger
from backend.config import (
    CITIES,
    DRIFT_PSI_WARNING_THRESHOLD,
    DRIFT_PSI_CRITICAL_THRESHOLD,
    DRIFT_PSI_EPSILON,
    DRIFT_PSI_BINS,
    MISSING_DATA_WARNING_PCT,
    MISSING_DATA_CRITICAL_PCT,
    MONITORING_WINDOW_DAYS,
    MLFLOW_TRACKING_URI,
)
from ML.utils import FEATURE_BASELINE_JSON, DRIFT_MONITORED_FEATURES, BEST_MODEL_PATH, PRODUCTION_MODEL_JSON

engine = get_engine()

# Training-period label distribution (2010-2019 primary split), §4 of
# docs/ML_METHODOLOGY_AND_LIMITATIONS.md - the measured reference live
# prediction distribution is compared against. Not re-derived here; this
# project has one documented source of truth for it.
REFERENCE_PREDICTION_DISTRIBUTION = {
    "Low": 94.996,
    "Medium": 2.994,
    "High": 1.509,
    "Extreme": 0.501,
}


# =====================================================
# STATUS HELPERS
# =====================================================

def _status_for(value, warning, critical, higher_is_better=False):
    if value is None:
        return "UNKNOWN"
    if higher_is_better:
        if value < critical:
            return "CRITICAL"
        if value < warning:
            return "WARNING"
        return "NORMAL"
    if value > critical:
        return "CRITICAL"
    if value > warning:
        return "WARNING"
    return "NORMAL"


def _worst_status(statuses):
    if "CRITICAL" in statuses:
        return "CRITICAL"
    if "WARNING" in statuses:
        return "WARNING"
    if "UNKNOWN" in statuses and "NORMAL" not in statuses:
        return "UNKNOWN"
    return "NORMAL"


# =====================================================
# PRODUCTION MODEL / TRAINING HISTORY
# =====================================================

def get_production_model_info():
    """The current live model. Prefers the MLOps registry (ml_model_versions
    status='Production'); falls back to the pre-existing file-based
    production_model.json manifest (ML/train_models.py) if nothing has
    been promoted through the registry yet - this project already had a
    working frozen-model story before this layer was added, and it must
    keep working unchanged until a human explicitly promotes a
    registered version."""

    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT * FROM ml_model_versions WHERE status = 'Production'
            ORDER BY promoted_at DESC LIMIT 1
        """)).mappings().first()

    if row:
        return {**dict(row), "source": "mlops_registry"}

    if not os.path.exists(PRODUCTION_MODEL_JSON):
        raise FileNotFoundError(
            "No production model found. Run `python ML/train_models.py` "
            "first, or `python ML/register_run.py` and promote a version."
        )

    with open(PRODUCTION_MODEL_JSON, "r") as f:
        manifest = json.load(f)

    metrics = manifest.get("evaluation_metrics", {})
    return {
        "algorithm": manifest.get("model"),
        "version": manifest.get("version"),
        "status": "Production",
        "trained_at": manifest.get("frozen_at"),
        "promoted_at": None,
        "accuracy": metrics.get("accuracy"),
        "macro_f1": metrics.get("macro_f1"),
        "high_risk_recall": metrics.get("high_risk_recall"),
        "extreme_risk_recall": metrics.get("extreme_risk_recall"),
        "roc_auc": metrics.get("roc_auc"),
        "selection_reason": manifest.get("selection_reason"),
        "source": (
            "production_model.json (not yet registered in the MLOps "
            "registry - run `python ML/register_run.py` then promote it "
            "to track it here)"
        ),
    }


def get_all_model_versions():
    """Latest version per algorithm, for the Model Registry view."""

    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT DISTINCT ON (algorithm) *
            FROM ml_model_versions
            ORDER BY algorithm, version DESC
        """)).mappings().all()
    return [dict(r) for r in rows]


def get_training_history(limit=50):
    """Every registered version across every training run, newest first -
    the Training History table (spec §9)."""

    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT v.*, r.train_file, r.test_file, r.dataset_train_rows, r.dataset_test_rows
            FROM ml_model_versions v
            JOIN ml_training_runs r ON r.id = v.training_run_id
            ORDER BY v.trained_at DESC
            LIMIT :limit
        """), {"limit": limit}).mappings().all()
    return [dict(r) for r in rows]


def get_performance_metrics():
    """Offline evaluation metrics for the current production model, tagged
    honestly - there is no live ground-truth flood-incident record
    anywhere in this project (docs/ML_METHODOLOGY_AND_LIMITATIONS.md
    §17.1), so a live accuracy/F1 cannot be computed and this never
    fabricates one. Becomes a real live comparison once §16's Phase 2
    (DMC river-gauge history) lands."""

    production = get_production_model_info()
    return {
        "algorithm": production.get("algorithm"),
        "version": production.get("version"),
        "evaluation_metrics": {
            "accuracy": production.get("accuracy"),
            "macro_f1": production.get("macro_f1"),
            "high_risk_recall": production.get("high_risk_recall"),
            "extreme_risk_recall": production.get("extreme_risk_recall"),
            "roc_auc": production.get("roc_auc"),
        },
        "ground_truth_available": False,
        "note": (
            "These are offline train/test evaluation metrics from the "
            "training run that produced this model, not live production "
            "accuracy - no historical or live flood-incident ground "
            "truth exists to measure that against yet. See "
            "docs/ML_METHODOLOGY_AND_LIMITATIONS.md §17.1 and §16."
        ),
    }


# =====================================================
# PROMOTE / ROLLBACK
# =====================================================

def promote_model_version(version_id, triggered_by="user"):
    """Make `version_id` the live production model. The same function
    handles both a fresh Candidate promotion and a rollback (promoting an
    older Archived version) - there is no separate rollback code path.
    Never deletes a version; the previous Production row is Archived,
    not removed, so it can always be promoted again later."""

    with engine.begin() as conn:
        target = conn.execute(
            text("SELECT * FROM ml_model_versions WHERE id = :id"),
            {"id": version_id},
        ).mappings().first()

        if not target:
            raise ValueError(f"No model version with id {version_id}")
        if target["status"] == "Production":
            raise ValueError(
                f"{target['algorithm']} v{target['version']} is already Production"
            )
        if not os.path.exists(target["artifact_path"]):
            raise FileNotFoundError(f"Artifact file missing: {target['artifact_path']}")

        previous = conn.execute(text("""
            UPDATE ml_model_versions SET status = 'Archived'
            WHERE status = 'Production'
            RETURNING algorithm, version
        """)).mappings().all()

        conn.execute(text("""
            UPDATE ml_model_versions
            SET status = 'Production', promoted_at = NOW()
            WHERE id = :id
        """), {"id": version_id})

        shutil.copy2(target["artifact_path"], BEST_MODEL_PATH)

        conn.execute(text("""
            INSERT INTO ml_retraining_events (event_type, details_json, triggered_by)
            VALUES ('promotion', :details, :triggered_by)
        """), {
            "details": json.dumps({
                "promoted": {"algorithm": target["algorithm"], "version": target["version"]},
                "demoted": [dict(p) for p in previous],
            }, default=str),
            "triggered_by": triggered_by,
        })

    logger.info(
        f"MLOps: promoted {target['algorithm']} v{target['version']} to Production "
        f"(triggered_by={triggered_by})"
    )
    _mlflow_transition_stage_best_effort(target["mlflow_run_id"])

    return {
        "algorithm": target["algorithm"],
        "version": target["version"],
        "status": "Production",
        "artifact_path": target["artifact_path"],
    }


def _mlflow_transition_stage_best_effort(mlflow_run_id):
    """Mirror the promotion into the MLflow Model Registry's stage, if
    MLflow is reachable. Purely cosmetic/audit - Postgres above is
    already the source of truth the live app reads, so any failure here
    is logged and swallowed, never raised (spec §18: "handle MLflow
    being temporarily unavailable gracefully")."""

    if not mlflow_run_id:
        return
    try:
        import mlflow
        from mlflow.tracking import MlflowClient
        from ML.train_models import MLFLOW_REGISTERED_MODEL_NAME

        mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
        client = MlflowClient()
        versions = client.search_model_versions(f"run_id='{mlflow_run_id}'")
        for v in versions:
            client.transition_model_version_stage(
                name=MLFLOW_REGISTERED_MODEL_NAME,
                version=v.version,
                stage="Production",
                archive_existing_versions=True,
            )
    except Exception as exc:
        logger.warning(f"MLflow stage transition skipped (non-fatal): {exc}")


# =====================================================
# FEATURE DRIFT
# =====================================================

def _load_feature_baseline():
    if not os.path.exists(FEATURE_BASELINE_JSON):
        return None
    with open(FEATURE_BASELINE_JSON, "r") as f:
        return json.load(f)


def _psi(quantile_edges, live_values):
    """Population Stability Index between a baseline distribution and a
    live sample bucketed into the baseline's own bin edges.

    PSI = sum over bins of (a_i - e_i) * ln(a_i / e_i), where a_i is the
    live proportion in bin i and e_i the baseline proportion.

    Binning: the baseline is supplied as its own quantile edges, so each
    bin holds exactly 1 / DRIFT_PSI_BINS of the baseline and e_i = 0.2 is
    exact rather than estimated. Edges are half-open on the left,
    (lo, hi], with the first bin extended to negative infinity and the
    last to positive infinity so that live values outside the training
    range are still counted rather than silently dropped.

    Smoothing: e_i cannot be zero by the construction above, so only the
    live proportion needs a floor. a_i is clamped below at
    DRIFT_PSI_EPSILON, which keeps the logarithm finite when a bin
    receives no live observations. An empty bin then contributes a large
    but bounded term, so a genuine collapse of the live distribution
    registers as critical drift instead of raising a math domain error.

    Thresholds: the 0.10 and 0.25 bands applied to this value by the
    caller are the conventional operational heuristics for PSI. They are
    not validated performance thresholds for this system; no relationship
    between a PSI band and predictive degradation has been established
    here, which is why a breach raises a retraining recommendation for
    human review rather than triggering anything automatically.
    """

    live = [v for v in live_values if v is not None]
    if not live or len(quantile_edges) != DRIFT_PSI_BINS + 1:
        return None

    n = len(live)
    expected_frac = 1.0 / DRIFT_PSI_BINS
    psi = 0.0
    for i in range(DRIFT_PSI_BINS):
        lo, hi = quantile_edges[i], quantile_edges[i + 1]
        if i == 0:
            count = sum(1 for v in live if v <= hi)
        elif i == DRIFT_PSI_BINS - 1:
            count = sum(1 for v in live if v > lo)
        else:
            count = sum(1 for v in live if lo < v <= hi)
        actual_frac = max(count / n, DRIFT_PSI_EPSILON)
        psi += (actual_frac - expected_frac) * math.log(actual_frac / expected_frac)
    return round(float(psi), 4)


def compute_drift_metrics(window_days=MONITORING_WINDOW_DAYS):
    """Real PSI per live-varying feature (Rainfall_3Day/Avg_Temperature/
    Avg_WindSpeed - see ML.utils.DRIFT_MONITORED_FEATURES for why
    Elevation/Coastal_Flag are excluded) vs. the training baseline. Pure
    computation, no DB write - see store_drift_metrics()/get_drift_status()
    for the two ways this gets used."""

    baseline = _load_feature_baseline()
    if baseline is None:
        return None

    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=window_days)).isoformat()
    with engine.connect() as conn:
        df = pd.read_sql(
            text('SELECT "Rainfall_3Day", "Avg_Temperature", "Avg_WindSpeed" FROM ml_features WHERE "Date" >= :cutoff'),
            conn, params={"cutoff": cutoff},
        )

    results = []
    for feature in DRIFT_MONITORED_FEATURES:
        feature_baseline = baseline.get("features", {}).get(feature)
        if not feature_baseline:
            continue
        live_values = df[feature].dropna().tolist() if feature in df.columns and not df.empty else []
        psi = _psi(feature_baseline["quantile_edges"], live_values)
        status = _status_for(psi, DRIFT_PSI_WARNING_THRESHOLD, DRIFT_PSI_CRITICAL_THRESHOLD) if psi is not None else "UNKNOWN"
        results.append({
            "feature_name": feature,
            "psi_score": psi,
            "status": status,
            "window_days": window_days,
            "live_sample_size": len(live_values),
        })
    return results


def store_drift_metrics(metrics):
    if not metrics:
        return
    with engine.begin() as conn:
        for m in metrics:
            conn.execute(text("""
                INSERT INTO ml_drift_metrics (feature_name, psi_score, status, window_days)
                VALUES (:feature_name, :psi_score, :status, :window_days)
            """), {k: m[k] for k in ("feature_name", "psi_score", "status", "window_days")})


def get_drift_status(window_days=MONITORING_WINDOW_DAYS):
    """Latest stored snapshot per feature; falls through to computing one
    on the spot (unstored) if the monitoring job hasn't run yet, so the
    endpoint is never empty just because the app was freshly started."""

    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT DISTINCT ON (feature_name) *
            FROM ml_drift_metrics
            ORDER BY feature_name, computed_at DESC
        """)).mappings().all()

    if rows:
        features = [dict(r) for r in rows]
        source = "stored_snapshot"
    else:
        features = compute_drift_metrics(window_days)
        source = "computed_on_demand"
        if features is None:
            return {
                "features": [],
                "overall_status": "UNKNOWN",
                "source": "no_baseline",
                "note": "No feature baseline yet - run `python ML/train_models.py` first.",
            }

    return {
        "features": features,
        "overall_status": _worst_status([f["status"] for f in features]) if features else "UNKNOWN",
        "source": source,
    }


# =====================================================
# PREDICTION DISTRIBUTION
# =====================================================

def compute_prediction_distribution(window_days=MONITORING_WINDOW_DAYS):
    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=window_days)).isoformat()
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT "Predicted_Risk" AS risk, COUNT(*) AS cnt
            FROM prediction_results
            WHERE "Date" >= :cutoff
            GROUP BY "Predicted_Risk"
        """), {"cutoff": cutoff}).mappings().all()

    total = sum(r["cnt"] for r in rows)
    if total == 0:
        return []

    return [
        {
            "risk_level": r["risk"],
            "count": r["cnt"],
            "percentage": round(r["cnt"] / total * 100, 3),
            "window_days": window_days,
        }
        for r in rows
    ]


def store_prediction_distribution(distribution):
    if not distribution:
        return
    with engine.begin() as conn:
        for d in distribution:
            conn.execute(text("""
                INSERT INTO ml_prediction_monitoring (risk_level, count, percentage, window_days)
                VALUES (:risk_level, :count, :percentage, :window_days)
            """), d)


def get_prediction_distribution(window_days=MONITORING_WINDOW_DAYS):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT DISTINCT ON (risk_level) *
            FROM ml_prediction_monitoring
            ORDER BY risk_level, computed_at DESC
        """)).mappings().all()

    live = [dict(r) for r in rows] if rows else compute_prediction_distribution(window_days)
    source = "stored_snapshot" if rows else "computed_on_demand"

    deviations = []
    for entry in live:
        reference_pct = REFERENCE_PREDICTION_DISTRIBUTION.get(entry["risk_level"])
        if reference_pct is not None:
            entry["reference_percentage"] = reference_pct
            deviations.append(abs(entry["percentage"] - reference_pct))

    return {
        "distribution": live,
        "reference_distribution": REFERENCE_PREDICTION_DISTRIBUTION,
        "max_deviation_pct_points": round(max(deviations), 2) if deviations else None,
        "source": source,
    }


# =====================================================
# MISSING DATA / DATA RELIABILITY SCORE
# =====================================================

def compute_data_quality_metrics(window_days=MONITORING_WINDOW_DAYS):
    """Real null-rate and city-coverage checks against weather_data/
    river_data - there is no pre-existing 'Data Reliability Score' in
    this codebase to integrate with (verified: nothing found anywhere
    under that name or an equivalent concept), so this is the first one;
    nothing else computes or displays a competing score."""

    cutoff_date = (datetime.now(timezone.utc).date() - timedelta(days=window_days)).isoformat()
    # Naive (no tzinfo) to match river_data."ReportTimestamp", a plain
    # TIMESTAMP column with no timezone convention established elsewhere
    # in this codebase (see database/db_connection.py's to_timestamp()
    # backfill) - avoids an implicit-cast timezone mismatch.
    cutoff_ts = datetime.utcnow() - timedelta(days=window_days)

    with engine.connect() as conn:
        weather = conn.execute(text("""
            SELECT
                COUNT(*) AS total,
                COUNT(DISTINCT "City") AS distinct_cities,
                COUNT(*) FILTER (WHERE "Rainfall" IS NULL) AS missing_rainfall,
                COUNT(*) FILTER (WHERE "Temperature" IS NULL) AS missing_temperature,
                COUNT(*) FILTER (WHERE "WindSpeed" IS NULL) AS missing_windspeed
            FROM weather_data WHERE "Date" >= :cutoff
        """), {"cutoff": cutoff_date}).mappings().first()

        river = conn.execute(text("""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE "WaterLevel" IS NULL) AS missing_waterlevel
            FROM river_data WHERE "ReportTimestamp" >= :cutoff
        """), {"cutoff": cutoff_ts}).mappings().first()

    def pct(missing, total):
        return round(missing / total * 100, 2) if total else None

    metrics = []

    def add(name, value, higher_is_better=False, details=None):
        status = _status_for(
            value,
            (100 - MISSING_DATA_WARNING_PCT) if higher_is_better else MISSING_DATA_WARNING_PCT,
            (100 - MISSING_DATA_CRITICAL_PCT) if higher_is_better else MISSING_DATA_CRITICAL_PCT,
            higher_is_better=higher_is_better,
        )
        metrics.append({
            "metric_name": name,
            "metric_value": value,
            "status": status,
            "details_json": json.dumps(details, default=str) if details else None,
        })

    weather_total = weather["total"] or 0
    add("missing_rate_rainfall_pct", pct(weather["missing_rainfall"], weather_total))
    add("missing_rate_temperature_pct", pct(weather["missing_temperature"], weather_total))
    add("missing_rate_windspeed_pct", pct(weather["missing_windspeed"], weather_total))

    expected_cities = len(CITIES)
    city_coverage_pct = (
        round((weather["distinct_cities"] or 0) / expected_cities * 100, 2)
        if expected_cities else None
    )
    add("city_coverage_pct", city_coverage_pct, higher_is_better=True,
        details={"expected_cities": expected_cities, "reporting_cities": weather["distinct_cities"]})

    river_total = river["total"] or 0
    add("missing_rate_river_level_pct", pct(river["missing_waterlevel"], river_total))

    missing_rates = [
        m["metric_value"] for m in metrics
        if m["metric_name"].startswith("missing_rate") and m["metric_value"] is not None
    ]
    avg_missing = sum(missing_rates) / len(missing_rates) if missing_rates else 0
    coverage_factor = (city_coverage_pct or 100) / 100
    reliability_score = round(max(0.0, 100 - avg_missing) * coverage_factor, 2)
    add("data_reliability_score", reliability_score, higher_is_better=True)

    for m in metrics:
        m["window_days"] = window_days
    return metrics


def store_data_quality_metrics(metrics):
    if not metrics:
        return
    with engine.begin() as conn:
        for m in metrics:
            conn.execute(text("""
                INSERT INTO ml_monitoring_metrics (metric_name, metric_value, status, details_json)
                VALUES (:metric_name, :metric_value, :status, :details_json)
            """), {k: m[k] for k in ("metric_name", "metric_value", "status", "details_json")})


def get_data_quality(window_days=MONITORING_WINDOW_DAYS):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT DISTINCT ON (metric_name) *
            FROM ml_monitoring_metrics
            ORDER BY metric_name, computed_at DESC
        """)).mappings().all()

    metrics = [dict(r) for r in rows] if rows else compute_data_quality_metrics(window_days)
    source = "stored_snapshot" if rows else "computed_on_demand"

    return {
        "metrics": metrics,
        "overall_status": _worst_status([m["status"] for m in metrics]) if metrics else "UNKNOWN",
        "source": source,
    }


# =====================================================
# RETRAINING EVENTS / HEALTH ROLLUP
# =====================================================

def record_retraining_event(event_type, details, triggered_by="system"):
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO ml_retraining_events (event_type, details_json, triggered_by)
            VALUES (:event_type, :details, :triggered_by)
        """), {
            "event_type": event_type,
            "details": json.dumps(details, default=str),
            "triggered_by": triggered_by,
        })
    logger.info(f"MLOps retraining event recorded: {event_type} ({triggered_by})")


def get_retraining_status(limit=20):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT * FROM ml_retraining_events ORDER BY created_at DESC LIMIT :limit
        """), {"limit": limit}).mappings().all()
    events = [dict(r) for r in rows]
    alerts = [e for e in events if e["event_type"] in ("drift_alert", "quality_alert", "performance_alert")]
    return {
        "events": events,
        "retraining_recommended": (
            bool(alerts) and bool(events) and alerts[0]["event_type"] == events[0]["event_type"]
        ),
        "latest_alert": alerts[0] if alerts else None,
        "note": (
            "A breach only ever produces this alert - retraining itself "
            "stays a deliberate, human-run `python ML/train_models.py` "
            "step, per docs/ML_METHODOLOGY_AND_LIMITATIONS.md §18."
        ),
    }


def get_health_rollup():
    drift = get_drift_status()
    quality = get_data_quality()

    # Data Source Reliability (see backend/services/reliability_service.py -
    # distinct from `quality` above, which is the simpler pre-existing
    # missing-rate score) folds into this rollup too, but degrades
    # gracefully to UNKNOWN if no source has been scored yet rather than
    # raising, matching every other signal here.
    try:
        from backend.services import reliability_service
        reliability_status = reliability_service.get_overall_reliability()["overall_level"]
        # HIGH/MEDIUM/LOW -> NORMAL/WARNING/CRITICAL, the vocabulary this
        # rollup already uses for every other signal.
        reliability_status = {"HIGH": "NORMAL", "MEDIUM": "WARNING", "LOW": "CRITICAL"}.get(
            reliability_status, "UNKNOWN"
        )
    except Exception:
        reliability_status = "UNKNOWN"

    overall = _worst_status([drift["overall_status"], quality["overall_status"], reliability_status])
    return {
        "status": overall,
        "drift_status": drift["overall_status"],
        "data_quality_status": quality["overall_status"],
        "data_source_reliability_status": reliability_status,
    }


# =====================================================
# MONITORING JOB ENTRY POINT (called by backend/scheduler.py)
# =====================================================

def run_monitoring_cycle(window_days=MONITORING_WINDOW_DAYS):
    """Computes and persists one snapshot of every monitored signal, and
    logs an alert event for any threshold breach. Called after every
    successful scheduled pipeline run (backend/scheduler.py). Never
    trains or promotes anything."""

    try:
        drift = compute_drift_metrics(window_days)
        if drift:
            store_drift_metrics(drift)
            breached = [d for d in drift if d["status"] in ("WARNING", "CRITICAL")]
            if breached:
                record_retraining_event("drift_alert", {"features": breached}, triggered_by="system")
    except Exception as exc:
        logger.error(f"MLOps monitoring: drift computation failed: {exc}")

    try:
        quality = compute_data_quality_metrics(window_days)
        store_data_quality_metrics(quality)
        breached = [m for m in quality if m["status"] in ("WARNING", "CRITICAL")]
        if breached:
            record_retraining_event("quality_alert", {"metrics": breached}, triggered_by="system")
    except Exception as exc:
        logger.error(f"MLOps monitoring: data-quality computation failed: {exc}")

    try:
        distribution = compute_prediction_distribution(window_days)
        store_prediction_distribution(distribution)
    except Exception as exc:
        logger.error(f"MLOps monitoring: prediction-distribution computation failed: {exc}")
