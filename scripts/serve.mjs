import http from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { context } from "esbuild";
import { catalog } from "./catalog.mjs";
import { bundleOptions } from "./bundle.mjs";
import { createLocalLibrary } from "./local-library.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const localLibrary = createLocalLibrary(root);
const apiUrl = process.env.CHANGES_API_URL
  ? new URL(process.env.CHANGES_API_URL)
  : null;
const devDir = await mkdtemp(path.join(tmpdir(), "changes-dev-"));
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
};
const build = await context(
  bundleOptions({ outfile: path.join(devDir, "app.js"), development: true }),
);
await build.rebuild();
await build.watch();
await catalog(root);
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (pathname.startsWith("/api/")) {
      const headers = new Headers();
      for (const name of ["authorization", "content-type"])
        if (req.headers[name]) headers.set(name, req.headers[name]);
      if (req.headers["content-length"])
        headers.set("content-length", req.headers["content-length"]);
      const request = new Request(
        apiUrl
          ? new URL(req.url, apiUrl).href
          : new URL(req.url, `http://${req.headers.host || "localhost"}`).href,
        {
          method: req.method,
          headers,
          ...(["GET", "HEAD"].includes(req.method)
            ? {}
            : { body: req, duplex: "half" }),
        },
      );
      const upstream = apiUrl
        ? await fetch(request)
        : await localLibrary(request);
      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.delete("content-encoding");
      responseHeaders.delete("content-length");
      responseHeaders.delete("www-authenticate");
      res.writeHead(upstream.status, Object.fromEntries(responseHeaders));
      res.end(Buffer.from(await upstream.arrayBuffer()));
      return;
    }
    if (pathname === "/tunes/index.json") await catalog(root);
    if (pathname === "/assets/app.js") {
      res.writeHead(200, {
        "Content-Type": "text/javascript",
        "Cache-Control": "no-store",
      });
      res.end(await readFile(path.join(devDir, "app.js")));
      return;
    }
    if (pathname === "/src/vendor/vexflow.js") {
      res.writeHead(200, { "Content-Type": "text/javascript" });
      res.end(
        await readFile(
          path.join(root, "node_modules/vexflow/build/cjs/vexflow.js"),
        ),
      );
      return;
    }
    const filename = path.resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (
      !filename.startsWith(root) ||
      pathname.split("/").some((s) => s.startsWith(".")) ||
      (!["/index.html", "/credits.html", "/styles.css"].includes(
        pathname === "/" ? "/index.html" : pathname,
      ) &&
        !/^\/(src|data|tunes)\//.test(pathname))
    ) {
      res.writeHead(404).end();
      return;
    }
    if (!(await stat(filename)).isFile()) throw new Error("Not a file");
    res.writeHead(200, {
      "Content-Type": types[path.extname(filename)] || "text/plain",
      "Cache-Control": "no-store",
    });
    res.end(await readFile(filename));
  } catch {
    res.writeHead(404).end("Not found");
  }
});
server.listen(Number(process.env.PORT || 5173), "127.0.0.1", () =>
  console.log(`Practice app: http://localhost:${process.env.PORT || 5173}`),
);
async function shutdown() {
  server.close();
  await build.dispose();
  await rm(devDir, { recursive: true, force: true });
}
process.once("SIGINT", () => void shutdown().then(() => process.exit()));
process.once("SIGTERM", () => void shutdown().then(() => process.exit()));
