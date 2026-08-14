import api from "./api";

export const getCities = async () => {
  const response = await api.get("/auth/cities");
  return response.data;
};

export const register = async ({ fullName, email, phone, password, alertCity }) => {
  const response = await api.post("/auth/register", {
    full_name: fullName,
    email,
    phone: phone || null,
    password,
    alert_city: alertCity,
  });
  return response.data;
};

export const login = async ({ email, password }) => {
  const response = await api.post("/auth/login", { email, password });
  return response.data;
};

export const getMe = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};

export const updateAlertCity = async (alertCity) => {
  const response = await api.put("/auth/me/alert-city", { alert_city: alertCity });
  return response.data;
};
