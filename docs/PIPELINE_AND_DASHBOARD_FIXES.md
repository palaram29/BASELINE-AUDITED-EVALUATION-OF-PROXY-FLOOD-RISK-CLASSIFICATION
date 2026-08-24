# Pipeline Hang Bug & Live Dashboard Fix — Documentation

## 1. The problem reported

The frontend dashboard was showing stale data and never reflected new
updates. Investigation traced this to **three separate, compounding
bugs** — none of them related to the ML model comparison work; this
was a pre-existing issue in the data pipeline and the frontend's
"live" dashboard.

---

## 2. Root causes found

### 2.1 `/system/river` hung forever (the primary blocker)

`backend/river_scraper.py` was written as a permanent background daemon:
it checks the DMC website once, then loops forever (`while True: ...
time.sleep(1)`) polling every 60 minutes. But `backend/services/system_service.py`'s
`run_river()` invoked it with `subprocess.run(["python", "backend/river_scraper.py"])`,
which blocks until the child process exits — and it never does.

Because `pipeline_service.run_full_pipeline()` calls `run_river()` as step
2 of 4, **every attempt to run the full pipeline (via `POST /system/river`
or `POST /system/run-pipeline`) hung indefinitely.** This is why the
database hadn't received a successful weather/river/prediction update in
weeks — nobody could get a pipeline run to actually complete.

### 2.2 Orphaned daemon processes already stuck in the background

Because of 2.1, earlier attempts to trigger the pipeline (before this fix)
had already spawned `python backend/river_scraper.py` child processes that
were never going to exit. These were found running via process inspection
(`Get-Process` / `Get-CimInstance Win32_Process`) and force-stopped. They
had been silently consuming request threads and causing every subsequent
pipeline call to time out too.

### 2.3 `uvicorn --reload` wasn't reliably picking up backend edits

While fixing 2.1, code changes to `system_service.py` and `river_scraper.py`
did not take effect for several minutes under `uvicorn --reload`, most
likely because the reload file-watcher was also scanning the very large
`node_modules` trees under the project root. The backend was restarted
**without** `--reload` to guarantee the fix was actually loaded, verified
by timing an isolated call to `/system/river` (0.88s vs. previously hanging
indefinitely).

### 2.4 The dashboard's "live" updates were entirely fake

`flood-frontend/src/hooks/useLiveDashboard.js` fetched `/dashboard/` once
on mount, then every 8 seconds nudged the already-loaded numbers by small
fixed deltas (via `utils/liveData.js`'s `simulateWeather/simulateRiver/simulatePrediction`)
to *look* like it was updating. It never called the backend again. So even
once the database had fresh data, an already-open dashboard tab would never
show it — only reflected fresh data was whatever existed in the database
at the moment the page was first loaded.

Additionally, the "simulate" jitter was also being applied to **genuinely
fetched real data** on every successful fetch, not just the demo fallback
— meaning even a single fresh page load didn't show the DB's exact values.

---

## 3. Files changed

| File | Change |
|---|---|
| `backend/river_scraper.py` | Moved the scheduling/`while True` daemon loop into a new `run_daemon()` function, guarded behind `if __name__ == "__main__":`. Added a `--once` CLI flag that runs a single `check_new_pdf()` cycle and exits. Running `python backend/river_scraper.py` directly (no args) still behaves exactly as before (a persistent daemon) — this only changes what happens when the module is imported or invoked with `--once`. |
| `backend/services/system_service.py` | `run_river()` now calls `subprocess.run(["python", "backend/river_scraper.py", "--once"])` instead of the bare script — a one-shot call that returns instead of hanging. |
| `flood-frontend/src/hooks/useLiveDashboard.js` | Replaced the fake 8-second client-side jitter with a genuine `setInterval(fetchDashboard, 30000)` that re-fetches `/dashboard/` from the backend every 30 seconds. Also removed the `simulateWeather/simulateRiver/simulatePrediction` wrapping that was previously applied to real fetched data — real values are now shown exactly as returned by the API. The `simulate*` helpers are still used, but only for the pure-demo fallback path (when the backend is unreachable). |

No database schema, routes, or other frontend pages were touched.

---

## 4. Verification performed

- Ran `python backend/river_scraper.py --once` directly with a hard 60s
  timeout as a safety net — completed cleanly (exit code 0) and found and
  processed a genuinely new DMC PDF from the day of testing.
- Found and killed orphaned `river_scraper.py` daemon processes using
  `Get-Process` / `Get-CimInstance Win32_Process` (Windows process
  inspection), confirming they were the actual cause of the hangs.
- Restarted the backend without `--reload` and confirmed a fresh, isolated
  call to `POST /system/river` completed in under a second (previously:
  indefinite hang).
- Triggered `POST /system/run-pipeline` end-to-end and confirmed all four
  steps (weather, river, ML features, prediction) reported `success: true`.
- Queried `GET /dashboard/` before and after: weather/prediction dates
  advanced from `2026-07-22` / `2026-07-06` to `2026-08-06` (the day of
  testing), and river data advanced from `5-Jul-2026` to `6-Aug-2026` —
  including a genuine new `Alert` status at the Kelani Ganga / Kithulgala
  station that hadn't existed in the stale data.
- Confirmed the frontend dev server picked up the `useLiveDashboard.js`
  change (Vite HMR) without errors.

---

## 5. What this means going forward

- `POST /system/river` and `POST /system/run-pipeline` are now safe to
  call from the API/frontend without risk of hanging a request forever.
- The main Dashboard page now genuinely re-polls the backend every 30
  seconds, so it will pick up new pipeline runs automatically without
  requiring a page reload.
- **Update (since this fix landed): the Weather, River, Prediction, and
  Statistics pages now poll too.** `useWeather`, `useRiver`,
  `usePrediction`, and `useStatistics` each carry the same
  `setInterval(fetch..., 30000)` pattern as `useLiveDashboard`, so every
  page that shows live pipeline data re-fetches every 30 seconds while
  it's open, not just on navigation. The follow-up this document
  originally suggested has been completed.
- `river_scraper.py`'s daemon mode (`python backend/river_scraper.py`, no
  args) is still the intended way to keep river data continuously fresh in
  the background — it is not started automatically by anything in this
  repo and must be run as a separate long-lived process (e.g. via a
  scheduler, systemd service, or Docker container) if continuous
  60-minute polling is desired, independent of API-triggered one-shot runs.
