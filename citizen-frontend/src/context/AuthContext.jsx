import { useEffect, useState, useCallback } from "react";
import { AuthContext } from "./authContextObject";
import { TOKEN_STORAGE_KEY } from "../services/api";
import {
  login as loginRequest,
  register as registerRequest,
  getMe,
  deleteAccount as deleteAccountRequest,
} from "../services/authService";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Only "loading" if there's a token to validate - otherwise the
  // logged-out state is already known on the first render.
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)));

  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return undefined;

    getMe()
      .then((data) => {
        if (isMounted) setUser(data);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const { user: loggedInUser, token } = await loginRequest(credentials);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const register = useCallback(async (payload) => {
    const { user: newUser, token } = await registerRequest(payload);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  }, []);

  const updateUser = useCallback((partialUser) => {
    setUser((prev) => (prev ? { ...prev, ...partialUser } : prev));
  }, []);

  const deleteAccount = useCallback(async (password) => {
    await deleteAccountRequest(password);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, updateUser, deleteAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}
