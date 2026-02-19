import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/sistema-citas/",
  server: {
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 5173,
      path: "/", // 👈 importante: NO usar /sistema-citas/ para el websocket de HMR
    },
  },
});
