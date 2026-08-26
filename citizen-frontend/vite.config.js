import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Distinct from flood-frontend (5173) so both apps can run at once
    // against the same backend. Backend CORS allows this origin - see
    // backend/app.py.
    port: 5174,
  },
});
