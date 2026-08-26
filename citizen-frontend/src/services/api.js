import axios from "axios";
import { API_BASE_URL } from "../constants/api";

// Separate storage key from flood-frontend so the two apps' sessions
// don't collide if a browser somehow hits both on the same origin.
export const TOKEN_STORAGE_KEY = "citizen_auth_token";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach the logged-in user's token to every request. Public endpoints
// (weather/river/prediction) ignore it; protected ones (auth/me,
// notifications) require it.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 means the token is missing/expired - drop it so the app falls
// back to the logged-out state instead of looping on failed requests.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    return Promise.reject(error);
  }
);

export default api;
