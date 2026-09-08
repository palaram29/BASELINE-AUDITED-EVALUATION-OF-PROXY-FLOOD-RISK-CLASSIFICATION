# Citizen Safety Page & Flood Shelters

Two related additions to the citizen app: a dedicated flood-precaution
reference page, and an operator-curated flood-shelter directory with a
nearest-shelter finder. Both are citizen-facing safety features — neither
touches the ML/prediction pipeline.

| Feature | Where |
|---|---|
| Precaution guide + emergency-kit checklist | `citizen-frontend/`, route `/safety` |
| Shelter directory (create/edit/retire) | `flood-frontend/`, route `/shelters` |
| Nearest-shelter finder + map pins | `citizen-frontend/`, `/safety` page + `/map` + Home |
| Backend | `backend/routes/shelters.py`, `backend/services/shelter_service.py`, `shelters` table |

---

## 1. Safety page (`citizen-frontend/src/pages/Safety.jsx`)

A standing, risk-independent reference — unlike the risk-tiered tips
already shown on Home's `RiskHero`, this page reads the same regardless of
the current forecast. Reachable from the main nav (`/safety`, a 5th tab
alongside Home/Weather/Rivers/Forecast) and via a "Full flood safety
guide" link on `RiskHero`.

Content lives in `citizen-frontend/src/utils/guidance.js`:

- `PRECAUTION_SECTIONS` — Before / During / After a flood, plain-language,
  Sri-Lanka-specific (DMC hotline, no email/SMS assumptions). Static
  content, not derived from any API.
- `EMERGENCY_KIT_ITEMS` — a starter packing list, rendered as interactive
  checkboxes by `components/EmergencyKitChecklist.jsx`. Checked state is
  stored in the browser's `localStorage` (`citizen_emergency_kit_checked`)
  only — nothing is sent to the backend, and state does not sync across
  devices.

The existing risk-tiered `RISK_GUIDANCE` / `guidanceFor()` (used by
`RiskHero` on Home) is unchanged and still keyed to the current forecast
tier.

---

## 2. Flood shelters

### Why this needed a data source first

Before this could be built, there was no shelter data anywhere in the
system — no table, no seed list. There is also no road-network graph or
live road-level flood status anywhere in the project, so a "route to
shelter, avoiding flooded roads" feature in the literal sense isn't
buildable on top of what this project has. The design below reflects two
deliberate scope decisions made before implementation:

1. **No custom routing engine.** `nearest_shelters()` ranks candidates by
   real straight-line (haversine) distance — a shortlisting signal, not a
   route. Each candidate is annotated with its own city's *current*
   forecast risk (from `alert_service.get_alert_for_city`) so a citizen
   can judge a shelter that happens to sit in a city already under a High
   alert. Actual turn-by-turn navigation is handed off to a **Google Maps
   directions link**, which does real road routing — safer than guessing
   at a routing engine with no live road-hazard data behind it.
2. **No new auth layer.** `flood-frontend` has no login (see
   [API_REFERENCE.md](API_REFERENCE.md)'s Authentication section); the
   `/shelters` write endpoints (`POST`/`PUT`/`DELETE`) follow that same
   existing convention rather than inventing an admin-auth system. This
   means anyone who can reach the operator console URL can create, edit,
   or delete shelter entries — accepted as a research-prototype risk, not
   something to rely on for a real public deployment without adding auth
   first.

Shelter designation is inherently dynamic — a school or temple opened as
a relief center for one flood event may not be one for the next — so this
is a plain **operator-editable table**, not a fixed seed list baked into
the app.

### Database

`shelters` table (`database/db_connection.py::ensure_shelters_table`):

| Column | Notes |
|---|---|
| `id` | serial PK |
| `name` | e.g. "Kaduwela Central College" |
| `type` | `school` \| `temple` \| `community_hall` \| `government_building` \| `other` |
| `latitude`, `longitude` | set by clicking a point on a map, not typed — see below |
| `city` | free text; matching one of the 30 monitored cities (`backend/config.py::CITIES`) enables the live risk badge, but isn't enforced |
| `capacity` | optional integer |
| `contact_phone` | optional |
| `is_active` | retire a shelter without losing its row/history |
| `created_at`, `updated_at` | |

### Backend

`backend/services/shelter_service.py`:

- `list_shelters()` — every shelter, active or not (the operator table
  needs both, to let a retired shelter be reactivated).
- `create_shelter(data)` / `update_shelter(id, data)` (partial) /
  `delete_shelter(id)` (hard delete).
- `nearest_shelters(lat, lon, limit=5)` — active shelters only, sorted by
  `_haversine_km`, each annotated with `distance_km`, `city_risk_level`,
  `city_risk_label`, and a ready-to-open `maps_url`
  (`https://www.google.com/maps/dir/?api=1&origin=...&destination=...`).

`backend/routes/shelters.py` — no auth (see above), Pydantic-validated
(`latitude`/`longitude` bounds-checked, `capacity >= 0`):

| Method | Path | Description |
|---|---|---|
| GET | `/shelters` | Every shelter, active or not |
| GET | `/shelters/nearest?lat=&lon=` | Ranked active shelters near a point, each with `distance_km`, `city_risk_level`/`city_risk_label`, `maps_url` |
| POST | `/shelters` | Create. Body: `name`, `type`, `latitude`, `longitude`, `city`, `capacity?`, `contact_phone?`, `is_active` (default `true`) |
| PUT | `/shelters/{id}` | Partial update (any subset of the above); `404` if the id doesn't exist |
| DELETE | `/shelters/{id}` | Hard delete; `404` if the id doesn't exist |

Registered in `backend/app.py`; `ensure_shelters_table()` runs on startup
alongside the other idempotent schema migrations.

### Operator console — `flood-frontend/` `/shelters`

New "Shelters" page under the Administration nav group
(`pages/Shelters/Shelters.jsx`, `hooks/useShelters.js`,
`services/shelterService.js`). Summary tiles (total / active / cities
covered), a table with edit/delete and a click-to-toggle active/inactive
badge, and an add/edit form.

Location entry is **click-a-point-on-a-map**, not typed coordinates —
`components/maps/ShelterLocationPicker.jsx` (Leaflet, reusing the
project's existing `react-leaflet` dependency) drops a pin where the
operator clicks. There's no geocoding anywhere in the project, so typing
an address was never an option.

### Citizen app — finder + map pins

`citizen-frontend/src/components/ShelterFinder.jsx`, embedded on the
`/safety` page:

- "Use my location" (browser geolocation) or "Use `<registered city>`
  instead" (falls back to the coordinates of the user's registered
  `alert_city` via `utils/cityCoords.js`).
- Calls `GET /shelters/nearest`, renders up to 5 candidates: name, type,
  city, distance, a risk badge when the shelter's city has forecast data,
  capacity/contact if set, and a "Get directions" link
  (`shelter.maps_url`, opens in a new tab).
- Empty state (no shelters registered yet) points to the DMC hotline
  (117) instead of showing nothing.

Shelter pins also render as a toggleable map layer (🏠 markers) in
`components/RiskMap.jsx`, wired into both `pages/Home.jsx` (embedded map)
and `pages/MapPage.jsx` (`/map`, full-screen) via a `shelters` prop
sourced from a new `getShelters()` call in `services/dataService.js`.
Only `is_active` shelters are drawn. Each marker's popup includes a
"Get directions" link built without an origin
(`.../dir/?api=1&destination=lat,lon`) since the map doesn't know the
viewer's location the way the finder does.

---

## Files touched

**Backend**: `database/db_connection.py` (+`ensure_shelters_table`),
`backend/services/shelter_service.py` (new),
`backend/routes/shelters.py` (new), `backend/app.py` (wiring).

**Operator console**: `flood-frontend/src/pages/Shelters/Shelters.jsx`
(new), `hooks/useShelters.js` (new), `services/shelterService.js` (new),
`components/maps/ShelterLocationPicker.jsx` (new),
`routes/AppRoutes.jsx`, `components/layout/navConfig.js`.

**Citizen app**: `citizen-frontend/src/pages/Safety.jsx` (new),
`components/EmergencyKitChecklist.jsx` (new),
`components/ShelterFinder.jsx` (new), `utils/guidance.js`
(+`PRECAUTION_SECTIONS`, `+EMERGENCY_KIT_ITEMS`),
`services/dataService.js` (+`getShelters`, `+getNearestShelters`),
`components/RiskMap.jsx` (+shelter layer), `pages/Home.jsx`,
`pages/MapPage.jsx`, `components/RiskHero.jsx` (+link to `/safety`),
`routes/AppRoutes.jsx`, `components/Layout.jsx` (+nav tab).

## Verified

CRUD and `nearest_shelters()` were exercised directly against the live
Postgres database (not mocked), and every `/shelters` HTTP endpoint was
hit manually, including a validation-error case (out-of-range latitude)
and a not-found case (`PUT`/`DELETE` on a missing id). Both frontends
build and lint clean. No automated test suite covers this yet — see
"Not yet done" below.

## Not yet done / known limitations

- **No automated tests.** `backend/tests/` has no coverage for
  `shelter_service.py` or the `/shelters` routes yet.
- **No operator auth.** Anyone reaching the `flood-frontend` URL can
  write shelter data (see the design-decision note above).
- **Distance is straight-line, not road distance.** A shelter ranked
  "nearest" may not be the shortest actual drive; the Maps link is where
  the real route comes from.
- **City-risk annotation depends on exact city-name matching.** A shelter
  whose `city` field doesn't exactly match one of the 30 monitored city
  names (`backend/config.py::CITIES`) gets no risk badge — the form
  suggests these via a datalist but doesn't enforce the match.
- **No shelters seeded.** The table ships empty; an operator has to add
  real shelters through `/shelters` before the citizen finder has
  anything to return.
