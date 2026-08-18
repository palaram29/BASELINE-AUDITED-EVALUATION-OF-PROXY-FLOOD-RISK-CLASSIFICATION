"""
Smoke-test for the MLOps layer - see docs/MLOPS_INTEGRATION_PLAN.md.

Checks, in order:
  1. The 6 ml_* tables exist and are queryable.
  2. ML/reports/feature_baseline.json exists (written by the last
     `python ML/train_models.py` run).
  3. At least one model version is registered, and whether one is
     currently Production.
  4. If the backend is running, hits every /mlops/* endpoint and prints
     a one-line summary of the real data returned - not just the HTTP
     status, so you can see whether the numbers look sane.

This does not replace actually looking at the numbers (e.g. cross-
checking a drift score by hand) - see the manual checklist in this
project's chat history / docs/MLOPS_INTEGRATION_PLAN.md for that.

Usage:
    python verify_mlops.py
    python verify_mlops.py --backend-url http://127.0.0.1:8000
    python verify_mlops.py --skip-api
"""

import argparse
import os

from sqlalchemy import text

from database.db_connection import get_engine
from ML.utils import FEATURE_BASELINE_JSON

PASS = "PASS"
FAIL = "FAIL"


def check(label, ok, detail=""):
    status = PASS if ok else FAIL
    print(f"[{status}] {label}" + (f" - {detail}" if detail else ""))
    return ok


def check_tables(engine):
    tables = [
        "ml_training_runs", "ml_model_versions", "ml_drift_metrics",
        "ml_prediction_monitoring", "ml_monitoring_metrics", "ml_retraining_events",
    ]
    all_ok = True
    with engine.connect() as conn:
        for t in tables:
            try:
                count = conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
                check(f"Table {t} exists", True, f"{count} row(s)")
            except Exception as exc:
                check(f"Table {t} exists", False, str(exc))
                all_ok = False
    return all_ok


def check_baseline():
    exists = os.path.exists(FEATURE_BASELINE_JSON)
    check(
        "Feature baseline (ML/reports/feature_baseline.json)", exists,
        "" if exists else "missing - run `python ML/train_models.py`",
    )
    return exists


def check_registry(engine):
    with engine.connect() as conn:
        candidate_count = conn.execute(text("SELECT COUNT(*) FROM ml_model_versions")).scalar()
        production = conn.execute(text(
            "SELECT algorithm, version FROM ml_model_versions WHERE status = 'Production'"
        )).mappings().first()

    check(
        "At least one registered model version", candidate_count > 0,
        f"{candidate_count} version(s)" if candidate_count else "0 - run `python ML/register_run.py`",
    )
    check(
        "A version is promoted to Production", production is not None,
        f"{production['algorithm']} v{production['version']}" if production
        else "none yet - promote one via /mlops page or POST /mlops/models/{id}/promote",
    )


def _summarize(path, data):
    if path == "/mlops/health":
        return f"status={data.get('status')}"
    if path == "/mlops/drift":
        return f"{len(data.get('features', []))} feature(s), overall={data.get('overall_status')}"
    if path == "/mlops/data-quality":
        return f"{len(data.get('metrics', []))} metric(s), overall={data.get('overall_status')}"
    if path == "/mlops/predictions":
        return f"{len(data.get('distribution', []))} risk level(s)"
    if isinstance(data, list):
        return f"{len(data)} item(s)"
    if isinstance(data, dict):
        return f"algorithm={data.get('algorithm')}" if "algorithm" in data else "ok"
    return "ok"


def check_endpoints(base_url):
    import requests

    endpoints = [
        "/mlops/model", "/mlops/models", "/mlops/training-history",
        "/mlops/performance", "/mlops/drift", "/mlops/data-quality",
        "/mlops/predictions", "/mlops/retraining-status", "/mlops/health",
    ]
    for path in endpoints:
        try:
            resp = requests.get(base_url + path, timeout=5)
            # 404 is expected/OK on /mlops/model and /mlops/performance
            # before any model has ever been trained.
            ok = resp.status_code == 200 or (resp.status_code == 404 and path in ("/mlops/model", "/mlops/performance"))
            summary = f"HTTP {resp.status_code}"
            if resp.status_code == 200:
                summary += f", {_summarize(path, resp.json())}"
            check(path, ok, summary)
        except Exception as exc:
            check(path, False, str(exc))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend-url", default="http://127.0.0.1:8000")
    parser.add_argument("--skip-api", action="store_true", help="Skip live endpoint checks (DB/file checks only)")
    args = parser.parse_args()

    print("=== MLOps layer verification ===\n")

    engine = get_engine()

    print("-- Database --")
    tables_ok = check_tables(engine)
    print()

    print("-- Training artifacts --")
    check_baseline()
    if tables_ok:
        check_registry(engine)
    print()

    if not args.skip_api:
        print(f"-- Live API ({args.backend_url}) --")
        check_endpoints(args.backend_url)
        print()

    print("Done. A FAIL on the API section usually just means the backend isn't running yet.")


if __name__ == "__main__":
    main()
