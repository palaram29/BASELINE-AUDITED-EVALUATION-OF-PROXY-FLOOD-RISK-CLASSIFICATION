import { useEffect, useState, useCallback } from "react";
import { AuthContext } from "./authContextObject";
import { TOKEN_STORAGE_KEY } from "../services/api";
import { login as loginRequest, register as registerRequest, getMe } from "../services/authService";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Only genuinely "loading" if there's a token to validate against
  // getMe() - otherwise there's no async work and the logged-out state
  // is already known on the first render.
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)));

  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (!token) {
      return;
    }

    getMe()
      .then((data) => {
        if (isMounted) setUser(data);
      })
      .catch(() => {
        // Token missing/expired/invalid - drop it silently and fall back
        // to the logged-out state rather than showing an error on load.
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

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
