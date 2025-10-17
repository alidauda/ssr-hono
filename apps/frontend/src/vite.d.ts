// src/vite.d.ts
import type { ViteDevServer } from "vite";

declare module "hono" {
  interface ContextVariableMap {
    vite: ViteDevServer;
  }
}
