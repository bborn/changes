import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

export function bundleOptions({ outfile, development = false }) {
  return {
    entryPoints: ["src/app.js"],
    absWorkingDir: root,
    outfile,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["es2022"],
    jsx: "automatic",
    sourcemap: development ? "inline" : false,
    minify: !development,
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        development ? "development" : "production",
      ),
    },
  };
}

export async function bundle(options) {
  return build(bundleOptions(options));
}
