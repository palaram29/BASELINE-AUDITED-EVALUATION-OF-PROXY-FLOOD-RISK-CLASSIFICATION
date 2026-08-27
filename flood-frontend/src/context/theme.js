import { createContext, useContext } from "react";

export const STORAGE_KEY = "flood-frontend-theme";

export const ThemeContext = createContext({
  theme: "light",
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}
