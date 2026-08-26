// The shared FastAPI backend (same instance the operator console uses).
// Override at build time with VITE_API_BASE_URL if the backend moves.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
