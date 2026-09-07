import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createLocalLibrary } from "../scripts/local-library.mjs";

const tune = {
  slug: "custom-local-test",
  title: "Local Test",
  key: "C",
  tempo: 120,
  style: "swing",
  timeSignature: "4/4",
  form: ["A"],
  sections: { A: { bars: [["Cmaj7"]] } },
};

const request = (path, method = "GET", body) =>
  new Request(`http://localhost${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });

test("local library persists valid songs and settings", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "changes-local-library-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const api = createLocalLibrary(root);

  assert.deepEqual(await (await api(request("/api/library"))).json(), {
    songs: [],
    settings: {},
  });
  assert.deepEqual(
    await (await api(request("/api/settings", "PUT", { tempo: 90 }))).json(),
    { saved: true },
  );
  const saved = await (await api(request("/api/songs", "PUT", tune))).json();
  assert.equal(saved.custom, true);

  const reloaded = createLocalLibrary(root);
  const library = await (await reloaded(request("/api/library"))).json();
  assert.equal(library.songs[0].slug, tune.slug);
  assert.deepEqual(library.settings, { tempo: 90 });
});

test("invalid songs are rejected without changing persisted data", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "changes-local-library-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const api = createLocalLibrary(root);
  await api(request("/api/songs", "PUT", tune));
  const before = await readFile(path.join(root, ".local/library.json"), "utf8");

  const response = await api(
    request("/api/songs", "PUT", { ...tune, tempo: 500 }),
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Invalid song settings/);
  assert.equal(
    await readFile(path.join(root, ".local/library.json"), "utf8"),
    before,
  );
});
