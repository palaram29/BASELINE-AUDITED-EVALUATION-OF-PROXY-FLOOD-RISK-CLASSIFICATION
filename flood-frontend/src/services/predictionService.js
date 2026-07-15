import api from "./api";

export const getLatestPrediction = async () => {
  const response = await api.get("/prediction/latest");
  return response.data;
};

export const getPredictionHistory = async () => {
  const response = await api.get("/prediction/history");
  return response.data;
};