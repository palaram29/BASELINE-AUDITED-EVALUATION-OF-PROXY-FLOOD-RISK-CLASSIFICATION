import api from "./api";

// ML model-comparison dashboard API. Mirrors backend/routes/ml.py 1:1.

export const getModels = async () => {
  const response = await api.get("/models");
  return response.data;
};

export const getBestModel = async () => {
  const response = await api.get("/best-model");
  return response.data;
};

export const trainModels = async (payload = {}) => {
  const response = await api.post("/train", payload);
  return response.data;
};

export const predictBestModel = async (city) => {
  const response = await api.post("/predict", { city });
  return response.data;
};

export const getMLPredictionHistory = async () => {
  const response = await api.get("/history");
  return response.data;
};
