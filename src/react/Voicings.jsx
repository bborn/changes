import React, { useMemo } from "react";
import {
  chordPitchClasses,
  getVoicings,
  noteName,
  notePc,
  parseChord,
} from "../theory.js";
import { planShapes } from "../voice-leading.js";
import { renderFretboard } from "../fretboard.js";
import { SvgMarkup } from "./SvgMarkup.jsx";
import { Keyboard, NoteNames } from "./Keyboard.jsx";

export function pianoVoicings(chord) {
  const pcs = chordPitchClasses(chord);
  const parsed = parseChord(chord);
  const root = parsed.rootPc;
  const ordered = [...pcs].sort(
    (a, b) => ((a - root + 12) % 12) - ((b - root + 12) % 12),
  );
  const bass = parsed.bass ? notePc(parsed.bass) : null;
  const upper = bass === null ? ordered : ordered.filter((pc) => pc !== bass);
  return upper.slice(0, 3).map((_, inversion) => {
    const rotated = [...upper.slice(inversion), ...upper.slice(0, inversion)];
    if (bass !== null) rotated.unshift(bass);
    let previous = 47;
    const pitches = rotated.map((pc) => {
      let pitch = 48 + pc;
      while (pitch <= previous) pitch += 12;
      previous = pitch;
      return pitch;
    });
    return {
      name:
        bass !== null
          ? `${parsed.bass} bass · position ${inversion + 1}`
          : inversion
            ? `Inversion ${inversion}`
            : "Root position",
      pitches,
    };
  });
}

export function Voicings({ state, actions }) {
  const instrument = state.instrument || "guitar";
  const planned = useMemo(
    () =>
      planShapes(state.tune, {
        zone: state.shapeZone,
        chorus: state.chorus,
        inversion: state.inversion,
      }),
    [state.tune, state.shapeZone, state.chorus, state.inversion],
  );
  let shapes = state.voicings || [];
  if (!shapes.length)
    try {
      shapes = getVoicings(state.chord);
    } catch {}
  const location =
    (state.playing || state.paused) && state.formIndex >= 0
      ? `${state.formIndex}-${state.barIndex}-${state.chordIndex ?? 0}`
      : null;
  const reminder =
    planned[location]?.shape ||
    Object.values(planned).find((e) => e.chord === state.chord)?.shape;
  if (!state.voicings && reminder)
    shapes = [
      reminder,
      ...shapes.filter((v) => v.frets.join(",") !== reminder.frets.join(",")),
    ].slice(0, 3);
  const chords = [
    ...new Set(
      Object.values(state.tune.sections).flatMap((section) =>
        section.bars.flat(),
      ),
    ),
  ];
  let piano = [];
  try {
    piano = pianoVoicings(state.chord);
  } catch {}
  const chordNotes =
    piano[0]?.pitches.map((pitch) => ({
      pitch,
      label: noteName(pitch),
      role: pitch % 12 === parseChord(state.chord).rootPc ? "target" : "chord",
    })) || [];
  return (
    <>
      <div className="panel-heading">
        <div>
          <h2 className="chord-title">
            {state.chord}{" "}
            <span>{instrument === "guitar" ? "voicings" : "notes"}</span>
          </h2>
        </div>
        <div className="panel-options">
          <label>
            <input
              type="checkbox"
              checked={state.follow}
              onChange={(e) => actions.setFollow(e.target.checked)}
            />{" "}
            Follow song
          </label>
          {instrument === "guitar" && (
            <label>
              <input
                type="checkbox"
                checked={state.notes}
                onChange={(e) => actions.setNotes(e.target.checked)}
              />{" "}
              Note names
            </label>
          )}
        </div>
      </div>
      <div className="chord-picker" aria-label="Choose a chord">
        {chords.map((chord) => (
          <button
            key={chord}
            onClick={() => actions.setChord(chord)}
            className={state.chord === chord ? "active" : ""}
          >
            {chord}
          </button>
        ))}
      </div>
      {instrument === "other" ? (
        <article className="voicing-card note-card">
          <h3>{state.chord}</h3>
          <NoteNames
            notes={chordNotes}
            activePitch={state.activePitch}
            onNote={(pitch) => actions.previewNotes([pitch])}
            label={`${state.chord} notes`}
          />
          <button
            className="preview"
            onClick={() =>
              actions.previewNotes(chordNotes.map((note) => note.pitch))
            }
          >
            ▷ <span>Play chord</span>
          </button>
        </article>
      ) : instrument === "piano" ? (
        <div className="voicing-grid piano-voicings">
          {piano.map((voicing, i) => {
            const notes = voicing.pitches.map((pitch) => ({
              pitch,
              label: noteName(pitch),
              role:
                pitch % 12 === parseChord(state.chord).rootPc
                  ? "target"
                  : "chord",
            }));
            return (
              <article className="voicing-card" key={voicing.name}>
                <span className="position-label">Position {i + 1}</span>
                <h3>{voicing.name}</h3>
                <Keyboard
                  notes={notes}
                  activePitch={state.activePitch}
                  onNote={(pitch) => actions.previewNotes([pitch])}
                  label={`${state.chord} ${voicing.name}`}
                />
                <button
                  className="preview"
                  onClick={() => actions.previewNotes(voicing.pitches)}
                >
                  ▷ <span>Play this voicing</span>
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="voicing-grid">
          {shapes.map((v, i) => {
            const fretted = v.frets.filter((f) => f !== null),
              start = Math.max(1, Math.min(...fretted)),
              end = Math.max(start + 4, ...fretted);
            const detail =
              v.rootString && v.tones[6 - v.rootString] === "R"
                ? `Root on string ${v.rootString} · fret ${v.frets[6 - v.rootString]}`
                : `Frets ${start}–${end}`;
            const svg = renderFretboard({
              startFret: fretted.includes(0) ? 0 : start,
              endFret: end,
              label: `${state.chord}: ${v.name}`,
              muted: v.frets.flatMap((f, j) => (f === null ? [6 - j] : [])),
              dots: v.frets.flatMap((f, j) =>
                f === null
                  ? []
                  : [
                      {
                        string: 6 - j,
                        fret: f,
                        label: state.notes ? v.notes[j] : v.tones[j],
                        emphasis: v.tones[j] === "R" ? "root" : "chord",
                      },
                    ],
              ),
            });
            return (
              <article
                className="voicing-card"
                key={`${v.name}-${v.frets.join(",")}`}
              >
                <span className="position-label">Position {i + 1}</span>
                <h3>{v.name}</h3>
                <p>{detail}</p>
                <SvgMarkup html={svg} />
                <button
                  className="preview"
                  onClick={() => actions.previewVoicing(i)}
                >
                  ▷ <span>Play this voicing</span>
                </button>
              </article>
            );
          })}
        </div>
      )}
      {instrument !== "other" && (
        <p className="legend">
          <span className="legend-dot root" />
          Root <span className="legend-dot chord" />
          Chord tone {instrument === "guitar" && <span>× Muted string</span>}
        </p>
      )}
    </>
  );
}
