import React from "react";
import { suggestSection } from "../../data/scales.js";
import {
  chordPitchClasses,
  noteName,
  parseChord,
  scalePitchClasses,
} from "../theory.js";
import { renderFretboard } from "../fretboard.js";
import { SvgMarkup } from "./SvgMarkup.jsx";

export function Scales({ state, actions }) {
  const currentChord = state.playing ? state.playbackChord : state.chord,
    suggestion = suggestSection(state.tune, state.section),
    name = state.alt && suggestion.alt ? suggestion.alt : suggestion.primary;
  let pcs = [],
    chordPcs = [],
    root = 0;
  try {
    pcs = scalePitchClasses(name);
    chordPcs = chordPitchClasses(currentChord);
    root = parseChord(currentChord).rootPc;
  } catch {}
  const tuning = [64, 59, 55, 50, 45, 40],
    dots = [];
  for (let string = 1; string <= 6; string++)
    for (let fret = 0; fret <= 15; fret++) {
      const pc = (tuning[string - 1] + fret) % 12;
      if (pcs.includes(pc) || chordPcs.includes(pc))
        dots.push({
          string,
          fret,
          label: noteName(pc),
          emphasis:
            pc === root ? "root" : chordPcs.includes(pc) ? "chord" : false,
        });
    }
  return (
    <>
      <div className="solo-mode">
        <button onClick={() => actions.setSoloMode("guide")}>
          Nearby notes
        </button>
        <button
          onClick={() => actions.setSoloMode("scales")}
          aria-pressed="true"
        >
          Full scale map
        </button>
      </div>
      <div className="panel-heading">
        <div>
          <h2>Scales for this section</h2>
        </div>
        <label className="section-select">
          Section{" "}
          <select
            value={state.section}
            onChange={(e) => actions.setSection(e.target.value)}
          >
            {Object.keys(state.tune.sections).map((id) => (
              <option value={id} key={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      </div>
      <article className="scale-card">
        <div className="scale-title">
          <div>
            <span className="position-label">Section {state.section}</span>
            <h3>{name}</h3>
            <p>{suggestion.notes}</p>
          </div>
          {suggestion.alt && (
            <button
              className="alternate"
              onClick={() => actions.setAlt(!state.alt)}
            >
              {state.alt ? "Use primary scale" : `Try ${suggestion.alt}`}
            </button>
          )}
        </div>
        <div className="neck-context">
          <span>Across the neck</span>
          <span>
            Current chord <b>{currentChord}</b>
          </span>
        </div>
        <div
          className="full-neck"
          tabIndex="0"
          role="region"
          aria-label="Scrollable fretboard"
        >
          <SvgMarkup
            html={renderFretboard({
              startFret: 0,
              endFret: 15,
              dots,
              label: `${name} with ${currentChord} chord tones highlighted`,
            })}
          />
        </div>
        <p className="legend">
          <span className="legend-dot root" />
          Chord root <span className="legend-dot chord" />
          Chord tones <span className="legend-dot scale" />
          Scale tones
        </p>
      </article>
    </>
  );
}
