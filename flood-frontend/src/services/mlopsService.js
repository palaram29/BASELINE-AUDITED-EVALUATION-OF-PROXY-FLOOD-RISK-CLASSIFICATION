import api from "./api";

// MLOps monitoring/lifecycle API. Mirrors backend/routes/mlops.py 1:1.
//
// Distinct from mlService.js (Model Comparison - unchanged). There is
// deliberately no "train"/"retrain" call here - the only mutating
// endpoint is promoteModelVersion, which only ever changes which
// already-trained version is live. See docs/MLOPS.md.

export const getProductionModel = async () => {
  const response = await api.get("/mlops/model");
  return response.data;
};

export const getModelVersions = async () => {
  const response = await api.get("/mlops/models");
  return response.data;
};

export const getTrainingHistory = async () => {
  const response = await api.get("/mlops/training-history");
  return response.data;
};

export const getPerformance = async () => {
  const response = await api.get("/mlops/performance");
  return response.data;
};

export const getDrift = async () => {
  const response = await api.get("/mlops/drift");
  return response.data;
};

export const getDataQuality = async () => {
  const response = await api.get("/mlops/data-quality");
  return response.data;
};

export const getPredictionDistribution = async () => {
  const response = await api.get("/mlops/predictions");
  return response.data;
};

export const getRetrainingStatus = async () => {
  const response = await api.get("/mlops/retraining-status");
  return response.data;
};

export const getHealth = async () => {
  const response = await api.get("/mlops/health");
  return response.data;
};

export const promoteModelVersion = async (versionId, triggeredBy = "user") => {
  const response = await api.post(`/mlops/models/${versionId}/promote`, { triggered_by: triggeredBy });
  return response.data;
};
