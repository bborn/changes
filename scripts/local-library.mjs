import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateTune } from "../backend/validation.js";

const MAX_BODY_BYTES = 1_048_576;
const MAX_SETTINGS_BYTES = 12_000;

const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

const problem = (message, status) => {
  throw Object.assign(new Error(message), { status });
};

async function requestBody(request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_BODY_BYTES) problem("Request too large.", 413);
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES)
    problem("Request too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    problem("Invalid request.", 400);
  }
}

export function createLocalLibrary(root) {
  const directory = path.join(path.resolve(root), ".local");
  const filename = path.join(directory, "library.json");
  let writes = Promise.resolve();

  async function load() {
    try {
      const value = JSON.parse(await readFile(filename, "utf8"));
      if (
        !value ||
        typeof value !== "object" ||
        !Array.isArray(value.songs) ||
        !Object.hasOwn(value, "settings")
      )
        throw new Error("Invalid local library");
      return value;
    } catch (error) {
      if (error.code === "ENOENT") return { songs: [], settings: {} };
      throw error;
    }
  }

  async function save(value) {
    await mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `library-${process.pid}.tmp`);
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporary, filename);
  }

  function update(change) {
    const result = writes.then(async () => {
      const library = await load();
      const response = await change(library);
      await save(library);
      return response;
    });
    writes = result.catch(() => {});
    return result;
  }

  return async function localLibrary(request) {
    try {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/api/library" && request.method === "GET") {
        await writes;
        return json(await load());
      }
      if (pathname === "/api/settings" && request.method === "PUT") {
        const settings = await requestBody(request);
        if (Buffer.byteLength(JSON.stringify(settings)) > MAX_SETTINGS_BYTES)
          problem("Settings too large.", 400);
        return await update((library) => {
          library.settings = settings;
          return json({ saved: true });
        });
      }
      if (pathname === "/api/songs" && request.method === "PUT") {
        const tune = validateTune(await requestBody(request));
        return await update((library) => {
          library.songs = [
            tune,
            ...library.songs.filter((song) => song?.slug !== tune.slug),
          ];
          return json(tune);
        });
      }
      return json({ error: "Not found." }, 404);
    } catch (error) {
      return json(
        { error: error.status ? error.message : "Local library is unavailable." },
        error.status || 500,
      );
    }
  };
}
