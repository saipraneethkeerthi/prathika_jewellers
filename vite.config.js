import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"
    }
  }
});
