# Front-ends

Two independent React (Vite) single-page apps talk to the same FastAPI
backend. They share nothing but the API.

| App | Dir | Dev port | Audience | Login |
|---|---|---|---|---|
| Operator / research console | `flood-frontend/` | 5173 | Operators, researchers | none — trusted read-only tooling |
| Public citizen app | `citizen-frontend/` | 5174 | General public | optional (JWT) for personal alerts |

Both: React 19 + React Router + Tailwind CSS + Axios. Maps use Leaflet /
React-Leaflet; charts use Recharts. API base URL is
`http://127.0.0.1:8000` (`citizen-frontend/` allows a
`VITE_API_BASE_URL` build override).

---

## Operator / research console — `flood-frontend/`

No authentication. Every screen polls its endpoint every 30 s
(`useLiveDashboard`, `useWeather`, `useRiver`, `usePrediction`,
`useStatistics`). Sidebar navigation:

| Route | Page | Reads |
|---|---|---|
| `/` | **Dashboard** | `/dashboard/`, `/reliability/summary`, `/system/status` — **Today / Tomorrow** toggle: Today = same-day rule-based risk index (`live_risk`) + observed weather/river; Tomorrow = t+1 ML forecast. Plus risk overview, rainfall chart, reliability widget, live-status pill |
| `/weather` | **Weather** | `/weather/latest`, `/weather/history` — table + chart, per-city search |
| `/river` | **River** | `/river/latest`, `/river/history` — station table, status timeline |
| `/prediction` | **Prediction** | `/prediction/latest`, `/prediction/history`, `/prediction/live` — **Today / Tomorrow** toggle: Today = rule-based same-day risk index + live weather/river; Tomorrow = per-city t+1 forecast table with the `degraded_data_warning` banner where reliability is low |
| `/statistics` | **Statistics** | `/stats/` — station counts, high-risk counts |
| `/pipeline` | **Pipeline** | `/system/status`; buttons `POST /system/*` and `/system/run-pipeline` |
| `/ml-dashboard` | **ML Dashboard** | `/models`, `/best-model`, `/history`, `POST /predict` — model comparison table, best-model panel, feature importance, confusion matrix, single-city live prediction |
| `/mlops` | **MLOps** | `/mlops/*` — production model, model registry, training history, drift, data quality, prediction distribution, retraining alerts, health rollup, promote/rollback |
| `/reliability` | **Data Reliability** | `/reliability/*` — overall + per-source scores, history chart, validation-flags audit table |
| `/users` | **User Management** | `/admin/users` — every citizen-app registration, their notification history and current area risk; read-only |
| `/shelters` | **Shelters** | `/shelters` (GET/POST/PUT/DELETE) — create/edit/retire flood shelters shown on the citizen safety page; location set by clicking a map, not typed. See [CITIZEN_SAFETY_AND_SHELTERS.md](CITIZEN_SAFETY_AND_SHELTERS.md) |
| `/about` | **About** | static |

The Navbar's live-status pill: `live` only when the scheduler's last run
succeeded recently, `warning` if stale/failed/never-run, `offline` if the
backend can't be reached.

---

## Public citizen app — `citizen-frontend/`

No ML / MLOps / reliability / pipeline screens. Consumes only public data
endpoints plus `/auth/*`, `/alerts/me`, and `/notifications/*`. Polls
every 60 s. Auth token is stored under its own localStorage key
(`AuthContext`), separate from anything the console uses.

| Route | Page | Auth | Description |
|---|---|---|---|
| `/` | **Home** | — | Your-area risk hero (if logged in) or a register prompt; embedded flood-risk map; national snapshot (highest risk **now** + **tomorrow**); emergency contacts |
| `/map` | **Map** | — | Full-screen interactive risk map (Leaflet, code-split & lazy-loaded so its ~160 KB never blocks first paint) |
| `/weather` | **Weather** | — | Latest weather per city, in plain language |
| `/rivers` | **Rivers** | — | Latest river-gauge levels and DMC status per station |
| `/forecast` | **Forecast** | `/prediction/latest`, `/prediction/live` | **Today / Tomorrow** toggle — "Flood risk right now" (rule-based same-day index) or "Tomorrow's flood risk" (next-day ML forecast) per city, sorted by risk, with a search box; both flagged "not an official warning" |
| `/safety` | **Safety** | — | Before/during/after flood precaution guide, an interactive emergency-kit checklist (localStorage), and a nearest-shelter finder (`/shelters/nearest`) with Google Maps directions. See [CITIZEN_SAFETY_AND_SHELTERS.md](CITIZEN_SAFETY_AND_SHELTERS.md) |
| `/alerts` | **Notifications** | JWT | Your in-app flood-alert history; opening the screen marks them read |
| `/account` | **Account** | JWT | Edit profile (name/email/phone), change alert area, link to alert history, and a "danger zone" to permanently delete the account (password required) |
| `/login`, `/register` | | — | Email/password; registration also picks an alert city |

`RequireAuth` redirects anonymous visitors away from `/alerts` and
`/account`. Anonymous visitors on Home get a resolved `null` for
`/alerts/me` instead of a guaranteed 401.

### Personal alerts

`GET /alerts/me` derives the user's current status from the latest
prediction for their `alert_city`. Separately, after every successful
pipeline run the backend raises an in-app notification **only when that
city's risk rises into a higher tier** (Moderate → High → Critical),
tracked by `users.last_alerted_risk`. When conditions ease below Moderate
the watermark clears, so a later rise alerts again. Nothing is emailed or
texted — see [MLOPS.md](MLOPS.md)'s and the root README's "Future
Improvements".

Risk wording is always "predicted"/"forecast risk", never "is flooding" —
the target is a derived index, not an observed event
([ML_METHODOLOGY_AND_LIMITATIONS.md](ML_METHODOLOGY_AND_LIMITATIONS.md)).
