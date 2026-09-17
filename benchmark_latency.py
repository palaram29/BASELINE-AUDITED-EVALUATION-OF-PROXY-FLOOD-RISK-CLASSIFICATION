#!/usr/bin/env python3
"""
benchmark_latency.py — measures the operational timings the paper is missing.

Fills the [RESULT REQUIRED] marker in Section V-C (Limitations) and gives
Objective 5 (operational efficiency) something measurable to stand on.

HOW TO RUN
----------
1. Put this file in the project root, next to backend/ and ML/.
2. Start the backend in another terminal:
       uvicorn backend.app:app --reload
3. Run:
       python benchmark_latency.py
4. Paste the whole printed report back into the chat.

It only reads and times things. It does not write to the database, does not
retrain, and does not touch any model artefact.
"""

import json
import os
import statistics as st
import subprocess
import sys
import time

BASE_URL = os.environ.get("FLOOD_API", "http://127.0.0.1:8000")
API_REPEATS = 20          # requests per endpoint
INFER_REPEATS = 100       # single-city inference repeats

PIPELINE_STEPS = [
    ("Weather collection",  ["python", "backend/weather_collector.py"]),
    ("River scrape+parse",  ["python", "backend/river_scraper.py", "--once"]),
    ("Feature generation",  ["python", "backend/generate_ml_features.py"]),
    ("Batch prediction",    ["python", "backend/predict_flood.py"]),
]

ENDPOINTS = [
    "/health/",
    "/dashboard/",
    "/prediction/latest",
    "/prediction/live",
    "/reliability/summary",
    "/mlops/health",
]


def sec(title):
    print("\n" + "=" * 68)
    print(title)
    print("=" * 68)


def summarise(label, samples_ms, unit="ms"):
    if not samples_ms:
        print(f"  {label:<28} no successful samples")
        return None
    s = sorted(samples_ms)
    n = len(s)
    out = {
        "n": n,
        "mean": st.mean(s),
        "median": st.median(s),
        "p95": s[min(n - 1, int(round(0.95 * (n - 1))))],
        "min": s[0],
        "max": s[-1],
    }
    print(f"  {label:<28} n={n:<4} mean={out['mean']:9.2f}  median={out['median']:9.2f}  "
          f"p95={out['p95']:9.2f}  min={out['min']:9.2f}  max={out['max']:9.2f}  ({unit})")
    return out


# ---------------------------------------------------------------- 1. pipeline
def bench_pipeline():
    sec("1. PIPELINE STAGE DURATION  (one full cycle, seconds)")
    print("  Each stage runs once, exactly as backend/services/system_service.py invokes it.\n")
    results, total = {}, 0.0
    for name, cmd in PIPELINE_STEPS:
        if not os.path.exists(cmd[1]):
            print(f"  {name:<28} SKIPPED — {cmd[1]} not found")
            continue
        t0 = time.perf_counter()
        try:
            proc = subprocess.run(cmd, capture_output=True, timeout=900)
            elapsed = time.perf_counter() - t0
            ok = proc.returncode == 0
        except subprocess.TimeoutExpired:
            elapsed, ok = time.perf_counter() - t0, False
        total += elapsed
        results[name] = {"seconds": round(elapsed, 3), "ok": ok}
        print(f"  {name:<28} {elapsed:8.2f} s   {'ok' if ok else 'FAILED (see exit code)'}")
    print(f"\n  {'END-TO-END TOTAL':<28} {total:8.2f} s")
    results["_total_seconds"] = round(total, 3)
    return results


# --------------------------------------------------------------- 2. inference
def bench_inference():
    sec(f"2. MODEL INFERENCE LATENCY  ({INFER_REPEATS} repeats, milliseconds)")
    try:
        import joblib
        import numpy as np
        import pandas as pd
    except ImportError as e:
        print(f"  SKIPPED — {e}")
        return None

    model_path = "ML/models/best_model.pkl"
    if not os.path.exists(model_path):
        print(f"  SKIPPED — {model_path} not found")
        return None

    t0 = time.perf_counter()
    model = joblib.load(model_path)
    load_ms = (time.perf_counter() - t0) * 1000
    print(f"  {'Model load (cold)':<28} {load_ms:9.2f} ms\n")

    n_feat = getattr(model, "n_features_in_", 6)
    single = pd.DataFrame([[0.0] * n_feat])
    batch30 = pd.DataFrame([[0.0] * n_feat] * 30)

    for _ in range(5):                      # warm up
        model.predict(single)

    single_ms = []
    for _ in range(INFER_REPEATS):
        t0 = time.perf_counter()
        model.predict(single)
        single_ms.append((time.perf_counter() - t0) * 1000)

    batch_ms = []
    for _ in range(INFER_REPEATS):
        t0 = time.perf_counter()
        model.predict(batch30)
        batch_ms.append((time.perf_counter() - t0) * 1000)

    r1 = summarise("Single city (1 row)", single_ms)
    r2 = summarise("All 30 cities (1 batch)", batch_ms)
    return {"model_load_ms": round(load_ms, 2), "single_row": r1, "batch_30": r2}


# --------------------------------------------------------------------- 3. API
def bench_api():
    sec(f"3. API RESPONSE LATENCY  ({API_REPEATS} requests each, milliseconds)")
    try:
        import requests
    except ImportError:
        print("  SKIPPED — requests not installed")
        return None

    try:
        requests.get(f"{BASE_URL}/health/", timeout=5)
    except Exception:
        print(f"  SKIPPED — no server reachable at {BASE_URL}")
        print("  Start it with:  uvicorn backend.app:app --reload")
        return None

    print(f"  Target: {BASE_URL}\n")
    out = {}
    for ep in ENDPOINTS:
        samples, errors = [], 0
        for _ in range(API_REPEATS):
            t0 = time.perf_counter()
            try:
                r = requests.get(BASE_URL + ep, timeout=30)
                dt = (time.perf_counter() - t0) * 1000
                samples.append(dt) if r.status_code == 200 else None
                if r.status_code != 200:
                    errors += 1
            except Exception:
                errors += 1
        res = summarise(ep, samples)
        if res:
            res["errors"] = errors
        out[ep] = res
    return out


# ------------------------------------------------------------------ 4. system
def environment():
    sec("4. ENVIRONMENT  (report this alongside the timings)")
    info = {"python": sys.version.split()[0], "platform": sys.platform}
    try:
        import platform
        import multiprocessing
        info["processor"] = platform.processor() or platform.machine()
        info["cpu_count"] = multiprocessing.cpu_count()
        info["os"] = platform.platform()
    except Exception:
        pass
    try:
        import psutil
        info["ram_gb"] = round(psutil.virtual_memory().total / 1e9, 1)
    except ImportError:
        info["ram_gb"] = "unknown (pip install psutil for this)"
    for k, v in info.items():
        print(f"  {k:<28} {v}")
    return info


if __name__ == "__main__":
    print("Flood Prediction System — operational timing benchmark")
    print("Measures pipeline, inference and API latency. Read-only.")

    report = {
        "environment": environment(),
        "inference": bench_inference(),
        "api": bench_api(),
        "pipeline": bench_pipeline(),   # last: it hits live external APIs
    }

    with open("benchmark_results.json", "w") as f:
        json.dump(report, f, indent=2, default=str)

    sec("DONE")
    print("  Full results also saved to benchmark_results.json")
    print("  Paste the output above (or the JSON file) back into the chat.")
