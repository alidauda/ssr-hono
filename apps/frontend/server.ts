import { Hono } from "hono";
import { render as RenderType } from "./src/entry-server";
import type { HttpBindings } from "@hono/node-server";
import { compress } from "hono/compress";
import { serveStatic } from "@hono/node-server/serve-static";
import type { ViteDevServer } from "vite";
import { stream } from "hono/streaming";
import { Transform, Readable } from "stream";
import { serve } from "@hono/node-server";

const isProduction = process.env.NODE_ENV === "production";
const port = process.env.PORT || 5173;
const base = process.env.BASE || "/";
const ABORT_DELAY = 10000;

let vite: ViteDevServer | undefined;

const app = new Hono<{ Bindings: HttpBindings }>();

if (!isProduction) {
  const { createServer } = await import("vite");
  vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    base,
  });
} else {
  app.use(compress());
  app.use(base, serveStatic({ root: "./dist/client" }));
}

if (!isProduction && vite) {
  app.use("*", async (c, next) => {
    const url = new URL(c.req.url);

    if (
      url.pathname.startsWith("/src/") ||
      url.pathname.startsWith("/@") ||
      url.pathname.includes(".")
    ) {
      return new Promise((resolve) => {
        vite!.middlewares(c.env.incoming, c.env.outgoing, () => {
          resolve(next());
        });
      });
    }

    return next();
  });
}

app.use("*", async (c) => {
  try {
    const url = c.req.url;

    let template: string;
    let render: typeof RenderType;

    if (!isProduction && vite) {
      template = await Bun.file("./index.html").text();
      template = await vite.transformIndexHtml(url, template);
      render = (await vite.ssrLoadModule("/src/entry-server.tsx")).render;
    } else {
      const templateHtml = await Bun.file("./dist/client/index.html").text();
      template = templateHtml;
      render = (await import("./dist/server/entry-server.js")).render;
    }

    const [htmlStart, htmlEnd] = template.split(`<!--app-html-->`);

    c.header("Content-Type", "text/html");

    return stream(c, async (stream) => {
      await stream.write(htmlStart!);
      let didError = false;

      const { pipe, abort } = render(url, {
        onShellError() {
          didError = true;
          console.error("Shell error occurred");
        },
        onShellReady() {
          console.log("Shell ready - streaming started");
        },
        onError(error) {
          didError = true;
          console.error("SSR Error:", error);
        },
      });

      const timeout = setTimeout(() => abort(), ABORT_DELAY);

      let streamEnded = false;
      const nodeTransform = new Transform({
        transform(chunk, encoding, callback) {
          if (streamEnded) {
            callback();
            return;
          }

          const chunkStr = chunk.toString();

          if (chunkStr.includes("<vite-streaming-end>")) {
            streamEnded = true;
            const finalChunk = chunkStr.replace(
              "<vite-streaming-end></vite-streaming-end>",
              ""
            );
            this.push(finalChunk + htmlEnd);
            this.push(null);
            clearTimeout(timeout);
          } else {
            this.push(chunk);
          }
          callback();
        },
      });

      pipe(nodeTransform);
      const webReadable = Readable.toWeb(nodeTransform);
      await stream.pipe(webReadable);
    });
  } catch (e) {
    if (!isProduction && vite) {
      vite.ssrFixStacktrace(e as Error);
    }
    console.error("SSR Error:", e);
    return c.text("Server Error", 500);
  }
});

if (import.meta.main) {
  console.log(`Server is running on port ${port}`);
  serve({
    fetch: app.fetch,
    port: Number(port),
  });
}
