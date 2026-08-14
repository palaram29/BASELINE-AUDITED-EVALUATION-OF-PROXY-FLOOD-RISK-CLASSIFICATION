import axios from "axios";
import { API_BASE_URL } from "../constants/api";

export const TOKEN_STORAGE_KEY = "flood_auth_token";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attaches the logged-in user's token, if any, to every request. Existing
// public endpoints (river/weather/prediction/dashboard/etc.) never required
// auth and still don't - the backend simply ignores the extra header on
// routes that don't check it, so this is additive and doesn't affect any
// unauthenticated request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;