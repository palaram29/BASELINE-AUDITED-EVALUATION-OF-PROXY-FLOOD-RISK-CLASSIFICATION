import api from "./api";

export const getStatistics = async () => {
  const response = await api.get("/stats");
  return response.data;
};