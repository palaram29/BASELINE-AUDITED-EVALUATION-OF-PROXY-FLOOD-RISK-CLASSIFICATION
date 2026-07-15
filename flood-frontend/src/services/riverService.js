import api from "./api";

export const getLatestRiver = async () => {
  const response = await api.get("/river/latest");
  return response.data;
};

export const getRiverHistory = async () => {
  const response = await api.get("/river/history");
  return response.data;
};