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

// Any field left undefined is left unchanged server-side.
export const updateProfile = async ({ fullName, phone, email } = {}) => {
  const payload = {};
  if (fullName !== undefined) payload.full_name = fullName;
  if (phone !== undefined) payload.phone = phone;
  if (email !== undefined) payload.email = email;

  const response = await api.put("/auth/me", payload);
  return response.data;
};

// Permanently deletes the account - the backend requires the current
// password to confirm, so a stolen/leaked token alone can't do this.
export const deleteAccount = async (password) => {
  await api.delete("/auth/me", { data: { password } });
};
