import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";
import { buildSoloPhrases } from "../src/solo-phrases.js";
import { notationEvents } from "../src/notation-model.js";
import { phraseBarEvents } from "../src/phrase-notation.js";

const bundle = new URL(`./.instrument-melody-${process.pid}.cjs`, import.meta.url);
await build({
  stdin: {
    contents: `
      import React from 'react';
      import {renderToStaticMarkup} from 'react-dom/server';
      import {Solo} from '../src/react/Solo.jsx';
      import {Melody} from '../src/react/Melody.jsx';
      export const solo=p=>renderToStaticMarkup(React.createElement(Solo,p));
      export const melody=p=>renderToStaticMarkup(React.createElement(Melody,p));
    `,
    resolveDir: new URL(".", import.meta.url).pathname,
    sourcefile: "instrument-melody-harness.jsx",
    loader: "jsx",
  },
  outfile: bundle.pathname,
  bundle: true,
  platform: "node",
  format: "cjs",
  logLevel: "silent",
});
const { solo, melody } = createRequire(import.meta.url)(bundle.pathname);
test.after(() => rm(bundle, { force: true }));

const tune = {
  slug: "synthetic-instruments",
  key: "C",
  style: "swing",
  timeSignature: "4/4",
  form: ["A"],
  sections: {
    A: {
      bars: [["Cmaj7"], ["Dm7"]],
      melody: [
        [{ midi: 60, beat: 0, duration: 4 }],
        [{ midi: 62, beat: 0, duration: 4 }],
      ],
    },
  },
};
const actions = new Proxy({}, { get: () => () => {} });
const engine = Object.assign(new EventTarget(), { activeSoloNote: null });
const base = {
  tune,
  instrument: "piano",
  soloStart: 5,
  soloRegister: "middle",
  soloLevel: "intermediate",
  soloFollow: true,
  soloPage: null,
  soloMode: "guide",
  loop: null,
  playing: false,
  paused: false,
  counting: false,
  formIndex: -1,
  barIndex: -1,
  chordIndex: 0,
  playPhrases: false,
  melodyMode: "tab",
  readingHints: true,
};

test("piano solo uses a register keyboard and standard notation riffs", () => {
  const html = solo({ state: base, actions, engine });
  assert.match(html, /aria-label="Solo register"/);
  assert.match(html, /class="keyboard"/);
  assert.match(html, /class="phrase-riff phrase-notation"/);
  assert.match(html, /Swing eighths/);
  assert.doesNotMatch(html, /Solo fret position|phrase-neck|riff-fret/);
});

test("non-guitar melody is Notes-only and never offers fret hints", () => {
  const html = melody({ state: base, actions });
  assert.match(html, /aria-pressed="true">Notes/);
  assert.match(html, /Tap a note to hear it/);
  assert.match(html, /data-score="0-0"/);
  assert.doesNotMatch(html, />Tab<|>Both<|fret position|melody-tab/);
});

test("written rhythms for generated non-guitar riffs are all notatable", () => {
  for (const style of ["swing", "bossa"])
    for (const level of ["beginner", "intermediate", "advanced"]) {
      const current = structuredClone(tune);
      current.style = style;
      for (const phrase of buildSoloPhrases(current, 5, {
        instrument: "piano",
        register: "middle",
        level,
      })) {
        const beats = phrase.beats / phrase.bars.length;
        phrase.bars.forEach((_, bar) => {
          const events = phraseBarEvents(phrase.riff, beats, bar * beats);
          assert.doesNotThrow(() =>
            notationEvents(events, current.key, current.timeSignature),
          );
          assert.equal(
            events.reduce((sum, event) => sum + event.duration, 0),
            beats,
          );
        });
      }
    }
});
