import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";

const bundle = new URL(
  `./.instrument-views-${process.pid}.cjs`,
  import.meta.url,
);
await build({
  stdin: {
    contents: `export { pianoVoicings } from '../src/react/Voicings.jsx'; export { keyboardRange } from '../src/react/Keyboard.jsx';`,
    resolveDir: new URL(".", import.meta.url).pathname,
    sourcefile: "instrument-views-harness.jsx",
    loader: "jsx",
  },
  outfile: bundle.pathname,
  bundle: true,
  platform: "node",
  format: "cjs",
  logLevel: "silent",
});
const { keyboardRange, pianoVoicings } = createRequire(import.meta.url)(
  bundle.pathname,
);
test.after(() => rm(bundle, { force: true }));

test("keyboard spans complete octaves around supplied notes", () => {
  assert.deepEqual(keyboardRange([{ pitch: 36 }, { pitch: 54 }]), [36, 59]);
  assert.deepEqual(keyboardRange([{ pitch: 72 }, { pitch: 83 }]), [72, 83]);
  assert.deepEqual(keyboardRange([]), [60, 71]);
});

test("piano positions contain ascending written chord pitches", () => {
  const allowed = new Set([0, 4, 7, 11]);
  for (const voicing of pianoVoicings("Cmaj7")) {
    assert.ok(voicing.pitches.every((pitch) => allowed.has(pitch % 12)));
    assert.ok(
      voicing.pitches.every((pitch, i, all) => !i || pitch > all[i - 1]),
    );
  }
});

test("slash chord positions keep the written bass lowest", () => {
  for (const [chord, bass, count] of [
    ["C/E", 4, 2],
    ["C/Bb", 10, 3],
  ]) {
    const voicings = pianoVoicings(chord);
    assert.equal(voicings.length, count);
    for (const voicing of voicings) {
      assert.equal(voicing.pitches[0] % 12, bass, `${chord}: ${voicing.name}`);
      assert.match(voicing.name, new RegExp(`${chord.split("/")[1]} bass`));
    }
  }
});
