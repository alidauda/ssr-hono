import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import hono from "@hono/vite-dev-server";
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    hono({
      entry: "src/server.ts",
    }),
  ],
});
