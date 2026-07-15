import api from "./api";

export const getHealth = async () => {
  const response = await api.get("/health");
  return response.data;
};