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

// Both forecasts for tomorrow, side by side: the persistence baseline
// (primary in the paper's own results - see ML/reports/*.csv) and the
// frozen ML model (secondary, carries an experimental-model disclaimer
// from the backend on every row). For the operator console, unlike the
// citizen app, both are shown - operators are the audience that actually
// needs the comparison, e.g. to judge whether/when the model is worth
// retraining. See backend/services/prediction_service.py.
export const getTomorrowComparison = async () => {
  const response = await api.get("/prediction/tomorrow-comparison");
  return response.data;
};