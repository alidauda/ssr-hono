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
const templateHtml = isProduction
  ? await Bun.file("./dist/client/index.html").text()
  : "";

const app = new Hono<{ Bindings: HttpBindings }>();

if (isProduction) {
  app.use(compress());
  app.use(base, serveStatic({ root: "./dist/client" }));
}

app.use("*", async (c) => {
  try {
    const url = c.req.url.replace(base, "");

    let template: string;
    let render: typeof RenderType;
    const vite = c.get("vite");
    if (!isProduction) {
      if (!vite) {
        throw new Error("Vite dev server not found in context");
      }
      template = await Bun.file("./index.html").text();
      template = await vite.transformIndexHtml(url, template);
      render = (await vite.ssrLoadModule("/src/entry-server.tsx")).render;
    } else {
      template = templateHtml;
      render = (await import("./dist/server/entry-server.js")).render;
    }

    const [htmlStart, htmlEnd] = template.split(`<!--app-html-->`);
    return stream(c, async (stream) => {
      const res = c.env.outgoing;
      await stream.write(htmlStart!);
      let didError = false;
      const { pipe, abort } = render(url, {
        onShellError() {
          c.status(didError ? 500 : 200);
          c.header("Content-Type", "text/html");
          c.html("<h1>Something went wrong</h1>");
        },
        onShellReady() {
          res.statusCode = didError ? 500 : 200;
          res.setHeader("Content-Type", "text/html");
          res.setHeader("Transfer-Encoding", "chunked");
        },
        onError() {
          didError = true;
        },
      });
      const timeout = setTimeout(() => abort(), ABORT_DELAY);
      const nodeTransform = new Transform({
        transform(chunk, encoding, callback) {
          const chunkStr = chunk.toString();
          if (chunkStr.includes("<vite-streaming-end>")) {
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
    const vite = !isProduction ? c.get("vite") : null;
    if (!isProduction && vite) {
      vite.ssrFixStacktrace(e as Error);
    }
    console.log("NODE_ENV =", process.env.NODE_ENV);
    console.error("SSR Error:", e);
    return c.text("Server Error", 500);
  }
});
export default {
  port,
  fetch: app.fetch,
};
