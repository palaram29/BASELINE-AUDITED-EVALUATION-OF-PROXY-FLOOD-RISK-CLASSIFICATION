import api from "./api";

export const getMyAlert = async () => {
  const response = await api.get("/alerts/me");
  return response.data;
};
