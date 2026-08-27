import api from "./api";

export const getLatestPrediction = async () => {
  const response = await api.get("/prediction/latest");
  return response.data;
};

export const getPredictionHistory = async () => {
  const response = await api.get("/prediction/history");
  return response.data;
};

// The same-day ("Today") flood-risk index - a deterministic
// Hazard x Vulnerability rule on the latest live weather, NOT the frozen
// t+1 ML model that getLatestPrediction() returns. See
// backend/services/live_risk_service.py.
export const getLiveRisk = async () => {
  const response = await api.get("/prediction/live");
  return response.data;
};