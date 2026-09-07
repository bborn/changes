import React, { useEffect, useMemo, useRef, useState } from "react";
import { melodyTab, renderTab } from "../chord-melody.js";
import { followMelody } from "../melody-scroll.js";
import { mountNotation } from "../notation.js";
import { SvgMarkup } from "./SvgMarkup.jsx";

function MelodyBar({ state, events, chords, fi, bi, number, actions }) {
  const key = `${fi}-${bi}`,
    melodyMode = (state.instrument || "guitar") === "guitar" ? state.melodyMode : "notes",
    active =
      (state.playing || state.paused) &&
      !state.counting &&
      state.formIndex === fi &&
      state.barIndex === bi;
  const playEvent = (e) => {
    const target = e.target.closest("[data-melody-preview]");
    if (!target) return;
    const index = Number(target.dataset.melodyPreview.split("-").at(-1)),
      pitches = events[index]?.shape?.pitches;
    if (pitches) actions.previewNotes(pitches);
  };
  const keyEvent = (e) => {
    if (e.key === "Enter" && e.target.closest("[data-melody-preview]")) {
      e.preventDefault();
      playEvent(e);
    }
  };
  return (
    <article className={`melody-bar ${active ? "current" : ""}`} data-bar={key}>
      <small>
        {number} <b>{chords.join(" → ")}</b>
      </small>
      {melodyMode === "tab" ? (
        <SvgMarkup
          html={renderTab(events, { previewPrefix: key })}
          onClick={playEvent}
          onKeyDown={keyEvent}
        />
      ) : (
        <div className="score-scroll">
          <div key={`${key}-${melodyMode}`} data-score={key} data-events={JSON.stringify(events)} />
        </div>
      )}
    </article>
  );
}

export function Melody({ state, actions }) {
  const guitar = (state.instrument || "guitar") === "guitar";
  const melodyMode = guitar ? state.melodyMode : "notes";
  const root = useRef(null),
    [hint, setHint] = useState(
      state.readingHints
        ? guitar
          ? "Tap a note for its fret position."
          : "Tap a note to hear it."
        : "",
    );
  const hasMelody = Boolean(state.tune.sections[state.tune.form[0]].melody);
  useEffect(() => {
    setHint(
      state.readingHints
        ? guitar
          ? "Tap a note for its fret position."
          : "Tap a note to hear it."
        : "",
    );
  }, [guitar, state.readingHints]);
  const bars = useMemo(
    () =>
      state.tune.form.flatMap((id, fi) => {
        if (!hasMelody) return [];
        if (
          state.loop &&
          (id !== state.loop || fi !== state.tune.form.indexOf(state.loop))
        )
          return [];
        const before = state.tune.form
          .slice(0, fi)
          .reduce((n, key) => n + state.tune.sections[key].bars.length, 0);
        return state.tune.sections[id].bars.map((chords, bi) => ({
          id,
          fi,
          bi,
          chords,
          number: before + bi + 1,
          events: melodyTab(state.tune.sections[id].melody[bi], chords),
        }));
      }),
    [hasMelody, state.tune, state.loop],
  );
  useEffect(() => {
    if (!hasMelody || melodyMode === "tab") return;
    let live = true;
    mountNotation(root.current, state.tune, {
      mode: melodyMode,
      hints: state.readingHints,
      positionHints: guitar,
      onPreview: actions.previewNotes,
      onReady: () => {
        if (live && state.formIndex >= 0)
          followMelody(root.current, `${state.formIndex}-${state.barIndex}`, {
            playing: state.playing,
          });
      },
    });
    return () => {
      live = false;
    };
  }, [
    actions.previewNotes,
    hasMelody,
    state.tune,
    state.loop,
    melodyMode,
    state.readingHints,
    guitar,
  ]);
  useEffect(() => {
    if (!hasMelody || state.formIndex < 0) return;
    followMelody(root.current, `${state.formIndex}-${state.barIndex}`, {
      playing: state.playing,
    });
  }, [hasMelody, state.formIndex, state.barIndex, state.playing]);
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    host.querySelectorAll("[data-melody-beat]").forEach((el) => {
      const bar = el.closest("[data-bar]"),
        active =
          (state.playing || state.paused) &&
          !state.counting &&
          bar?.dataset.bar === `${state.formIndex}-${state.barIndex}` &&
          (state.melodyBeat ?? state.beat) >= Number(el.dataset.melodyBeat) &&
          (state.melodyBeat ?? state.beat) < Number(el.dataset.melodyEnd);
      el.classList.toggle("current-note", active);
    });
  }, [
    state.playing,
    state.paused,
    state.counting,
    state.formIndex,
    state.barIndex,
    state.beat,
    state.melodyBeat,
    melodyMode,
  ]);
  if (!hasMelody)
    return (
      <article className="scale-card">
        <h2>Melody</h2>
        <p>
          This song has chord changes, but its melody arrangement hasn’t been
          added yet.
        </p>

        <p className="chart-help">
          Single-note melody. More song melodies are still needed.
        </p>
      </article>
    );
  return (
    <div ref={root}>
      <div className="melody-tools">
        <div className="reading-modes" role="group" aria-label="Melody display">
          {(guitar ? [
            ["tab", "Tab"],
            ["both", "Both"],
            ["notes", "Notes"],
          ] : [["notes", "Notes"]]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => actions.setMelodyMode(mode)}
              aria-pressed={melodyMode === mode}
            >
              {label}
            </button>
          ))}
        </div>
        {melodyMode !== "tab" && (
          <>
            <button
              onClick={() => {
                actions.setReadingHints(!state.readingHints);
                setHint(
                  !state.readingHints
                    ? guitar
                      ? "Tap a note for its fret position."
                      : "Tap a note to hear it."
                    : "",
                );
              }}
              aria-pressed={state.readingHints}
            >
              Hints
            </button>
            <span className="reading-help" data-reading-help role="status">
              {hint}
            </span>
          </>
        )}
        {state.tune.melodySource?.url?.startsWith("https://") && (
          <a href={state.tune.melodySource.url} target="_blank" rel="noopener">
            Source
          </a>
        )}
      </div>
      <div
        className={`melody-chart ${melodyMode !== "tab" ? "reading-chart" : ""}`}
      >
        {[0, 1, 2].map((cycle) => (
          <div
            className={`melody-cycle ${melodyMode !== "tab" ? "reading-chart" : ""}`}
            data-melody-cycle={cycle}
            key={cycle}
          >
            {bars.map((bar) => (
              <MelodyBar
                {...bar}
                state={state}
                actions={actions}
                key={`${cycle}-${bar.fi}-${bar.bi}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
