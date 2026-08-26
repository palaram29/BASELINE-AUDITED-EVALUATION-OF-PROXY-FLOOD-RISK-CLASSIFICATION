import api from "./api";

// Public observed/forecast data - no auth required.
export const getLatestWeather = async () => (await api.get("/weather/latest")).data;
export const getLatestRiver = async () => (await api.get("/river/latest")).data;
export const getLatestPrediction = async () => (await api.get("/prediction/latest")).data;

// The logged-in user's current flood-alert status for their registered
// city (JWT required).
export const getMyAlert = async () => (await api.get("/alerts/me")).data;
