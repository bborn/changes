import {tune as fixture} from './fixtures/synthetic.js';
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";

const bundle = new URL(`./.react-views-${process.pid}.cjs`, import.meta.url);
await build({
  stdin: {
    contents: `
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {PracticeViews} from '../src/react/PracticeViews.jsx';
  export const render=props=>renderToStaticMarkup(React.createElement(PracticeViews,props));
 `,
    resolveDir: new URL(".", import.meta.url).pathname,
    sourcefile: "react-views-harness.jsx",
    loader: "jsx",
  },
  outfile: bundle.pathname,
  bundle: true,
  platform: "node",
  format: "cjs",
  logLevel: "silent",
});
const { render } = createRequire(import.meta.url)(bundle.pathname);
test.after(() => rm(bundle, { force: true }));

const actions = new Proxy({}, { get: () => () => {} });
const baseState = {
  view: "melody",
  loop: null,
  melodyMode: "tab",
  readingHints: false,
  playing: false,
  paused: false,
  counting: false,
  formIndex: -1,
  barIndex: -1,
  chordIndex: 0,
  beat: -1,
  melodyBeat: -1,
  soloMode: "guide",
  soloLevel: "intermediate",
  soloStart: 5,
  soloFollow: true,
  soloPage: null,
  playPhrases: false,
  shapeZone: "nearby",
  inversion: "auto",
  chorus: 0,
  follow: true,
  notes: false,
  alt: false,
  section: "A",
  chord: "Cmaj7",
  playbackChord: "Cmaj7",
};

test("melody view renders its empty state without reading absent melody bars", async () => {
  const tune = structuredClone(fixture); delete tune.sections.A.melody;
  const html = render({ state: { ...baseState, tune }, actions });
  assert.match(html, /hasn.t been added yet/);

});

test("melody view server-renders tab, combined, and notation modes", async () => {
  const tune = structuredClone(fixture);
  const tab = render({
    state: { ...baseState, tune, melodyMode: "tab" },
    actions,
  });
  const both = render({
    state: { ...baseState, tune, melodyMode: "both" },
    actions,
  });
  const notes = render({
    state: { ...baseState, tune, melodyMode: "notes" },
    actions,
  });
  assert.match(tab, /class="melody-tab"/);
  assert.doesNotMatch(tab, /data-score=/);
  assert.match(both, /data-score="0-0"/);
  assert.match(both, /class="melody-chart reading-chart"/);
  assert.match(notes, /data-score="0-0"/);
  for (const [mode, html] of [
    ["tab", tab],
    ["both", both],
    ["notes", notes],
  ])
    assert.match(
      html,
      new RegExp(
        `aria-pressed="true">${mode[0].toUpperCase() + mode.slice(1)}`,
      ),
    );
});

test("solo view renders inert wrap copies, six-string maps, and visible tab for every bar", () => {
  const tune = {
    slug: "react-solo-test",
    title: "Solo test",
    key: "C",
    tempo: 100,
    style: "straight",
    timeSignature: "4/4",
    form: ["A"],
    sections: {
      A: { label: "A", bars: [["Cmaj7"], ["Dm7"], ["G7"], ["Cmaj7"]] },
    },
  };
  const html = render({
    state: { ...baseState, tune, view: "scales" },
    actions,
  });
  assert.match(html, /data-phrase-copy=""[^>]*inert=""/);
  const firstPage = html.match(
    /<article class="phrase-page[^>]*>([\s\S]*?)<\/article>/,
  )?.[1];
  assert.ok(firstPage, "renders an original phrase page");
  assert.equal(
    (firstPage.match(/class="string-label"/g) || []).length,
    6,
    "nearby map renders all six strings",
  );
  assert.equal(
    (firstPage.match(/class="phrase-riff"/g) || []).length,
    2,
    "two-bar phrase renders one visible riff staff per bar",
  );
  assert.doesNotMatch(
    firstPage,
    /<details|<summary/,
    "riff tab is not hidden behind disclosure UI",
  );
});

test('every example note is visible on its fretboard before playback',async()=>{
  const {buildSoloPhrases}=await import('../src/solo-phrases.js');
  const tune={slug:'read-ahead',title:'Read ahead',style:'bossa',timeSignature:'4/4',form:['A'],sections:{A:{bars:[['Fmaj7'],['Gb7']]}}};
  const soloPhrases=buildSoloPhrases(tune,5,{level:'intermediate'});
  assert.ok(soloPhrases[0].riff.some(n=>!soloPhrases[0].dots.some(d=>d.string===n.string&&d.fret===n.fret)),'fixture includes a note omitted by the compact map');
  const html=render({state:{...baseState,tune,view:'scales',soloPhrases},actions});
  const first=html.match(/<article class="phrase-page[^>]*>([\s\S]*?)<\/article>/)[1];
  for(const note of soloPhrases[0].riff)assert.ok(first.includes(`data-solo-position="${note.string}-${note.fret}"`));
  assert.doesNotMatch(first,/riff-only|display:none/);
});

test('solo tab shows held notes continuing into the following measure',()=>{
 const tune={slug:'ties',style:'swing',timeSignature:'4/4',form:['A'],sections:{A:{bars:[['Dm7'],['G7']]}}};
 const html=render({state:{...baseState,tune,view:'scales'},actions});
 assert.match(html,/class="riff-tie"/);
});

test('solo phrasing picker preserves the selected style separately from difficulty', () => {
  for (const soloPhrasing of ['varied','motivic','lyrical']) {
    const html = render({state: {...baseState, view:'scales', tune:fixture, soloPhrasing, soloLevel:'advanced'}, actions});
    assert.match(html, /aria-label="Solo phrasing"/);
    assert.match(html, new RegExp(`value="${soloPhrasing}" selected=""`));
    assert.match(html, /aria-label="Solo difficulty" aria-valuetext="advanced"/);
  }
});
