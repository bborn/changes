import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseInitialTune,
  isPracticeSpace,
  mergeRestoredSettings,
} from "../src/react/session.js";

test("cloud practice settings override stale local restoration values", () => {
  const restored = mergeRestoredSettings(
    { slug: "local-song", tempo: 90, loop: "A", melodyMode: "tab" },
    { slug: "cloud-song", tempo: 145, loop: "B" },
  );
  assert.deepEqual(restored, {
    slug: "cloud-song",
    tempo: 145,
    loop: "B",
    melodyMode: "tab",
  });
});

test("saved custom tune is selected as an object before React state can settle", () => {
  const builtIn = { slug: "autumn-leaves" };
  const custom = {
    slug: "custom-123",
    custom: true,
    sections: { A: { bars: [["Cm7"]] } },
  };
  assert.equal(chooseInitialTune([builtIn, custom], "custom-123"), custom);
  assert.equal(chooseInitialTune([builtIn, custom], "missing"), builtIn);
  assert.equal(chooseInitialTune([], "missing"), null);
});

test("practice Space shortcut ignores typing, composition, modifiers and repeats only by caller policy", () => {
  const space = {
    code: "Space",
    key: " ",
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    isComposing: false,
  };
  assert.equal(isPracticeSpace(space), true);
  assert.equal(isPracticeSpace(space, true), false);
  assert.equal(isPracticeSpace({ ...space, isComposing: true }), false);
  assert.equal(isPracticeSpace({ ...space, metaKey: true }), false);
  assert.equal(
    isPracticeSpace({ ...space, code: "Enter", key: "Enter" }),
    false,
  );
  assert.equal(
    isPracticeSpace({ ...space, shiftKey: true }),
    true,
    "Shift-Space remains available for restart",
  );
});
