# Citizen Flood Watch app

A public, responsive React app for residents of Sri Lanka. It shows the flood
risk for your area in plain language, an interactive risk map, current weather,
river levels and the next-day forecast, and lets you register with a location so
flood alerts appear in the app whenever the risk for that area rises.

The layout adapts to the viewport: a bottom tab bar and single-column cards on
phones, a top navigation bar and 2-3 column grids on tablet/desktop.

It deliberately does **not** expose the ML, MLOps, pipeline, reliability or
statistics screens — that is the separate `../flood-frontend` operator console.

## Run

```bash
npm install
npm run dev          # http://localhost:5174
```

The backend must be running (`python -m uvicorn backend.app:app --reload` from the
repo root, http://127.0.0.1:8000). Override the API URL with `VITE_API_BASE_URL`.

```bash
npm run build        # production bundle in dist/
npm run lint
```

## What talks to what

| Screen | Backend endpoint | Auth |
| --- | --- | --- |
| Home – your area's risk | `GET /alerts/me` | JWT |
| Home – map / snapshot, plus `/map` full-screen | `GET /prediction/latest` + `GET /river/latest` | public |
| Forecast | `GET /prediction/latest` | public |
| Weather | `GET /weather/latest` | public |
| Rivers | `GET /river/latest` | public |
| Register / Login / Account | `/auth/register`, `/auth/login`, `/auth/me`, `/auth/me/alert-city`, `/auth/cities` | mixed |
| Alerts (bell + `/alerts`) | `GET /notifications`, `POST /notifications/mark-read` | JWT |

Alerts are created server-side by `backend/services/notification_service.py` after
each pipeline run — see the repo README's "In-app flood-alert notifications".

## Structure

- `src/pages/` — Home, MapPage (`/map` full-screen), Weather, Rivers, Forecast, Notifications, Login, Register, Account, NotFound
- `src/components/` — `Layout` (header + bottom tab bar), `RiskHero`, `LazyRiskMap` + `RiskMap`,
  `NotificationBell`, `LocationPicker` (city list + "use my location"), `EmergencyContacts`,
  `NationalSnapshot`, `common/`
- `src/hooks/` — `useAuth`, `useLiveData` (polling fetch), `useNotifications`
- `src/utils/` — `risk` (tiers/labels/colours/hex), `riverLevels`, `guidance` (what-to-do + hotlines),
  `cityCoords` (geolocation → nearest monitored city), `mapData` (city↔district + river coords), `format`
- `src/data/` — `sriLankaDistricts.json` (district polygons for the map)
- `src/services/` — `api` (axios + token), `authService`, `dataService`, `notificationService`

### The map

The map is embedded on **Home** and also has a full-screen route at **`/map`** (linked from the
"Full map" control on Home) — there is no separate Map tab.

`RiskMap.jsx` holds every Leaflet import (and `leaflet/dist/leaflet.css`) and is loaded via
`React.lazy` inside `LazyRiskMap.jsx`, so the ~160 KB of Leaflet + react-leaflet is a separate
async chunk that never blocks first paint. `LazyRiskMap` also gates *when* that chunk loads: the
`/map` page passes `eager` (load immediately); on Home it waits until the map scrolls near the
viewport (`IntersectionObserver`), so a quick bounce or a tall high-risk hero on a phone doesn't
pull it.

The map draws: coloured dots = per-town next-day risk forecast (`/prediction/latest`), ringed
white dots = live river gauges (`/river/latest`), subtle polygons = district risk (worst forecast
among a district's towns), a highlight ring on the logged-in user's town, and (on `/map`) an
optional "you are here" pin from the browser's geolocation.
