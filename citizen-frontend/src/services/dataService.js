import api from "./api";

// Public observed/forecast data - no auth required.
export const getLatestWeather = async () => (await api.get("/weather/latest")).data;
export const getLatestRiver = async () => (await api.get("/river/latest")).data;
export const getLatestPrediction = async () => (await api.get("/prediction/latest")).data;
// Same-day ("today") flood-risk index - a rule-based Hazard x Vulnerability
// score on current weather, not the next-day ML forecast above.
export const getLiveRisk = async () => (await api.get("/prediction/live")).data;

// Both forecasts for TOMORROW, side by side: the persistence baseline
// (primary - the paper's own results show it beats the trained model on
// every check run) and the frozen ML model (secondary, always carrying an
// experimental-model disclaimer). See backend/routes/prediction.py.
export const getTomorrowComparison = async () => (await api.get("/prediction/tomorrow-comparison")).data;

// The logged-in user's current flood-alert status for their registered
// city (JWT required).
export const getMyAlert = async () => (await api.get("/alerts/me")).data;

// Every shelter (active + inactive) - callers should filter to
// is_active themselves. Used to draw shelter pins on the map.
export const getShelters = async () => (await api.get("/shelters")).data;

// Active shelters near (lat, lon), nearest first, each annotated with its
// city's current flood-risk forecast and a ready-to-open Google Maps
// directions link - see backend/services/shelter_service.py for why this
// is straight-line ranking + a Maps hand-off, not turn-by-turn routing.
export const getNearestShelters = async (lat, lon) =>
  (await api.get("/shelters/nearest", { params: { lat, lon } })).data;
