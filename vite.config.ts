import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  // Production is served as https://www.futeboldealagoas.net/urano.
  // Keep the development server at the root for the existing local workflow.
  base: process.env.NODE_ENV === "production" ? "/urano/" : "/",

  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
  },
});
