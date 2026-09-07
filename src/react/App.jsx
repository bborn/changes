import {PRACTICE_LOOPS} from '../practice-loops.js';
import React, { useEffect, useRef } from "react";
import { PracticeViews, Voicings } from "./PracticeViews.jsx";
import { usePractice } from "./usePractice.js";

const KEYS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const VIEWS = [
  ["chart", "Chart", "Chart"],
  ["voicings", "Chords", "Chord shapes"],
  ["scales", "Solo", "Solo guide"],
  ["melody", "Melody", "Melody"],
];
function MusicIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M8 25V9l17-4v16M8 14l17-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <ellipse cx="5" cy="25" rx="4" ry="3" fill="currentColor" />
      <ellipse cx="22" cy="21" rx="4" ry="3" fill="currentColor" />
    </svg>
  );
}
function ViewIcon({ view }) {
  if (view === "chart")
    return (
      <svg
        className="ui-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 12h18M12 4v16" />
      </svg>
    );
  if (view === "voicings")
    return (
      <svg
        className="ui-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M5 3v18M12 3v18M19 3v18M3 7h18M3 16h18" />
        <circle cx="12" cy="11" r="2" fill="currentColor" />
      </svg>
    );
  return (
    <svg
      className="ui-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M3 17h18M3 7h18" />
      <circle cx="6" cy="17" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="18" cy="7" r="2" fill="currentColor" />
    </svg>
  );
}
function shelf(state) {
  const slugs = [
    state.tune?.slug,
    ...state.recent,
    ...state.tunes.slice(0, 4).map((t) => t.slug),
  ];
  return [...new Set(slugs)]
    .map((slug) => state.tunes.find((t) => t.slug === slug))
    .filter(Boolean)
    .slice(0, 8);
}
function Sidebar({ state, actions }) {
  const songs = shelf(state);
  return (
    <aside className="sidebar" inert={state.sheet}>
      <button
        className="sidebar-toggle"
        data-sidebar-toggle
        aria-expanded={!state.sidebarCollapsed}
        aria-label={
          state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
        }
        onClick={actions.toggleSidebar}
      >
        {state.sidebarCollapsed ? "›" : "‹"}
      </button>
      <a className="brand" href="/">
        <MusicIcon />
        <span>Changes</span>
      </a>
      <div className="library-heading">
        <h2>Recent songs</h2>
        <span>{songs.length}</span>
      </div>
      <nav className="tune-list" aria-label="Choose a tune">
        {songs.map((song) => (
          <button
            key={song.slug}
            className={`tune ${song.slug === state.tune?.slug ? "selected" : ""}`}
            aria-pressed={song.slug === state.tune?.slug}
            onClick={() => {
              actions.loadTune(song.slug);
              actions.feedback();
            }}
          >
            <span>{song.title}</span>
            <small>
              {song.key} <i>·</i> {song.style} <i>·</i> {song.tempo} bpm
            </small>
            {song.slug === state.tune?.slug && <span className="tune-dot" />}
          </button>
        ))}
      </nav>
      <label className="mobile-tune-picker">
        Tune
        <select
          value={state.tune?.slug || ""}
          onChange={(e) => {
            actions.loadTune(e.target.value);
            actions.feedback();
          }}
        >
          {songs.map((song) => (
            <option key={song.slug} value={song.slug}>
              {song.title}
            </option>
          ))}
        </select>
      </label>
      <button
        className="add-song"
        data-add-song
        disabled={state.loading}
        onClick={actions.findSong}
      >
        Find a song
      </button>
      <label className="practice-loop-picker">Practice loops
        <select aria-label="Practice loop" value="" onChange={e=>actions.tryPracticeLoop(e.target.value)}>
          <option value="" disabled>Choose a loop…</option>
          {PRACTICE_LOOPS.map(loop=><option key={loop.id} value={loop.id}>{loop.title}</option>)}
        </select>
      </label>
    </aside>
  );
}
function SettingsButton({ state, actions }) {
  return (
    <button
      className="band-button"
      data-band-open
      aria-label="Settings"
      aria-controls="band-panel"
      aria-expanded={state.bandOpen}
      onClick={() => actions.toggleSettings()}
    >
      ⚙
    </button>
  );
}
function Header({ state, actions }) {
  const tune = state.tune;
  return (
    <>
      <header className="tune-header">
        <div>
          <h1>{tune.title}</h1>
          <div className="tune-meta">
            <label className="key-picker">
              Key{" "}
              <select
                value={tune.key}
                aria-label="Song key"
                onChange={(e) => actions.transpose(e.target.value)}
              >
                {KEYS.map((root) => {
                  const key = root + (tune.key.endsWith("m") ? "m" : "");
                  return (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  );
                })}
              </select>
            </label>
            <span>{tune.style}</span>
            <span>{tune.timeSignature}</span>
          </div>
        </div>
        <div className="header-actions">
          <SettingsButton state={state} actions={actions} />
        </div>
      </header>
      <div className="view-bar">
        <div className="tabs" aria-label="Practice view">
          {VIEWS.map(([view, label, aria]) => (
            <button
              key={view}
              aria-label={aria}
              aria-pressed={state.view === view}
              className={state.view === view ? "active" : ""}
              onClick={() => actions.setView(view)}
            >
              <ViewIcon view={view} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
function Settings({ state, actions }) {
  const ref = useRef(null),
    actionsRef = useRef(actions);
  actionsRef.current = actions;
  useEffect(() => {
    const previous = document.activeElement;
    ref.current
      ?.querySelector("[data-band-close]")
      ?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <section
      ref={ref}
      className="band-settings mixer-panel"
      id="band-panel"
      role="dialog"
      aria-label="Settings"
      onKeyDown={(e) => {
        if (e.key === "Escape") actionsRef.current.toggleSettings(false);
      }}
    >
      <header>
        <h2>Settings</h2>
        <button
          data-band-close
          aria-label="Close settings"
          onClick={() => actions.toggleSettings(false)}
        >
          ×
        </button>
      </header>
      <div className="mixer-tracks">
        {Object.entries(state.tracks).map(([name, track]) => (
          <div className="mixer-track" key={name}>
            <button
              role="switch"
              aria-checked={!track.muted}
              aria-label={name[0].toUpperCase() + name.slice(1)}
              onClick={() => actions.setTrackMuted(name)}
            >
              <span className="mixer-switch" aria-hidden="true" />
              {name[0].toUpperCase() + name.slice(1)}
            </button>
            <input
              aria-label={`${name} volume`}
              type="range"
              min="0"
              max="1"
              step=".05"
              value={track.volume}
              onChange={(e) => actions.setTrackVolume(name, e.target.value)}
            />
          </div>
        ))}
      </div>
      {state.tune?.custom && (
        <div className="settings-song-actions">
          <button onClick={() => actions.editSong(state.tune)}>
            Edit song
          </button>
          <button onClick={actions.exportSong}>Export JSON</button>
        </div>
      )}
    </section>
  );
}
function Transport({ state, actions }) {
  const beats = Number(state.tune.timeSignature.split("/")[0]) || 4,
    playLabel = state.loading
      ? "Loading…"
      : state.starting
        ? "Starting…"
        : state.playing
          ? "Pause"
          : state.paused
            ? "Resume"
            : "Play";
  return (
    <div className="transport" inert={state.sheet}>
      {["chart", "voicings"].includes(state.view) && (
        <div className="mini-reminder">
          <label className="shape-position">
            Position{" "}
            <select
              aria-label="Chord shape position"
              value={state.shapeZone}
              onChange={(e) => actions.selectShapeZone(e.target.value)}
            >
              <option value="nearby">Stay nearby</option>
              <option value="low">Low frets</option>
              <option value="middle">Middle frets</option>
              <option value="high">High frets</option>
              <option value="explore">Move each chorus</option>
            </select>
          </label>
          <label className="shape-position">
            Inversion{" "}
            <select
              aria-label="Chord inversion"
              value={state.inversion}
              onChange={(e) => actions.selectInversion(e.target.value)}
            >
              <option value="auto">Auto</option>
              <option value="0">Root position</option>
              <option value="1">1st inversion</option>
              <option value="2">2nd inversion</option>
              <option value="3">3rd inversion</option>
            </select>
          </label>
        </div>
      )}
      <div className="play-controls">
        <button
          className={`play-button ${state.playing ? "playing" : ""}`}
          disabled={state.starting || state.loading}
          aria-label={
            state.playing
              ? "Pause playback"
              : state.paused
                ? "Resume playback"
                : "Play backing track"
          }
          onClick={() => actions.togglePlay()}
        >
          <span aria-hidden="true">{state.playing ? "Ⅱ" : "▶"}</span>{" "}
          {playLabel}
        </button>
        <div className="transport-context">
          <b>
            {(state.playing || state.paused) && state.counting
              ? state.beat >= 0
                ? `Count-in ${state.beat + 1}`
                : "Count-in"
              : ""}
          </b>
        </div>
        <div className="beat-dots" aria-label="Current beat">
          {Array.from({ length: beats }, (_, beat) => (
            <i
              className={
                (state.playing || state.paused) && beat === state.beat
                  ? "lit"
                  : ""
              }
              key={beat}
            />
          ))}
        </div>
      </div>
      <div className="tempo-control">
        <button
          aria-label="Decrease tempo by 5"
          onClick={() => actions.setTempo(state.tempo - 5)}
        >
          −
        </button>
        <label>
          <b>{state.tempo}</b>
          <span>bpm</span>
          <input
            type="range"
            min="40"
            max="240"
            value={state.tempo}
            aria-label="Tempo"
            onChange={(e) => actions.setTempo(e.target.value)}
          />
        </label>
        <button
          aria-label="Increase tempo by 5"
          onClick={() => actions.setTempo(state.tempo + 5)}
        >
          +
        </button>
      </div>
      <div className="transport-options">
        <SettingsButton state={state} actions={actions} />
        <span className="shortcut-hint">
          <kbd>Space</kbd> pause / resume · <kbd>Shift Space</kbd> restart
        </span>
        <button
          title={
            state.loop
              ? "Stop looping this section"
              : "Repeat the entire song, including repeated sections"
          }
          className={`loop-indicator ${state.loop ? "on" : ""}`}
          aria-label={
            state.loop
              ? "Clear section loop"
              : "Repeat the entire song, including repeated sections"
          }
          onClick={actions.clearLoop}
        >
          ↻ {state.loop ? "Stop loop" : "Whole song"}
        </button>
      </div>
    </div>
  );
}
function VoicingSheet({ state, actions, engine }) {
  const ref = useRef(null),
    actionsRef = useRef(actions);
  actionsRef.current = actions;
  useEffect(() => {
    const sheet = ref.current,
      previous = document.activeElement;
    sheet?.querySelector(".close-sheet")?.focus();
    const trap = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        actionsRef.current.closeSheet();
      }
      if (e.key !== "Tab") return;
      const controls = [
          ...sheet.querySelectorAll("button,input,select,a[href]"),
        ].filter((el) => !el.disabled),
        first = controls[0],
        last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    sheet?.addEventListener("keydown", trap);
    return () => {
      sheet?.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <>
      <div className="sheet-shade" onClick={actions.closeSheet} />
      <section
        ref={ref}
        className="voicing-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Chord voicings"
      >
        <button
          className="close-sheet"
          aria-label="Close voicings"
          onClick={actions.closeSheet}
        >
          ×
        </button>
        <div id="sheet-content">
          <Voicings state={state} actions={actions} engine={engine} />
        </div>
      </section>
    </>
  );
}
export function App() {
  const { state, actions, engine } = usePractice();
  useEffect(() => {
    document
      .querySelector("#app")
      ?.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  }, [state.sidebarCollapsed]);
  useEffect(() => {
    if (
      !state.chartFollow ||
      !(state.playing || state.paused) ||
      state.counting ||
      state.view !== "chart" ||
      state.sheet ||
      document.querySelector("dialog[open]")
    )
      return;
    const bar = document.querySelector(
      `[data-bar="${state.formIndex}-${state.barIndex}"]`,
    );
    if (!bar) return;
    const siblings = [...bar.parentElement.children],
      next = siblings[siblings.indexOf(bar) + 1],
      rect = bar.getBoundingClientRect(),
      bottom =
        Math.min(
          innerHeight,
          document.querySelector(".transport")?.getBoundingClientRect().top ??
            innerHeight,
        ) - 16;
    if (
      rect.top < 16 ||
      Math.max(rect.bottom, next?.getBoundingClientRect().bottom ?? 0) > bottom
    )
      window.scrollBy({
        top: rect.top - 24,
        behavior:
          state.view === "melody" &&
          state.playing &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "smooth"
            : "instant",
      });
  }, [
    state.formIndex,
    state.barIndex,
    state.counting,
    state.playing,
    state.paused,
    state.view,
    state.sheet,
    state.chartFollow,
  ]);
  return (
    <>
      <Sidebar state={state} actions={actions} />
      <main className="workspace" aria-busy={state.loading} inert={state.sheet}>
        {state.error && (
          <div className="error" role="alert">
            {state.error} <button onClick={actions.retry}>Try again</button>
          </div>
        )}
        {state.tune ? (
          <>
            <Header state={state} actions={actions} />
            <div id="view-content">
              <PracticeViews state={state} actions={actions} engine={engine} />
            </div>
          </>
        ) : (
          <section className="scale-card"><h1>{state.loading ? "Loading…" : "Your practice library"}</h1>{!state.loading && <><p>Add your own chart or import song JSON to start practicing.</p><button className="play-button" onClick={() => actions.tryPracticeLoop()}>Try a practice loop</button><button className="add-song" onClick={actions.findSong}>Add a song</button><p>On the public demo, songs stay in this browser. Export them to keep a backup.</p></>}</section>
        )}
      </main>
      {state.tune && <Transport state={state} actions={actions} />}{" "}
      {state.bandOpen && <Settings state={state} actions={actions} />}{" "}
      {state.sheet && (
        <VoicingSheet state={state} actions={actions} engine={engine} />
      )}
    </>
  );
}
export default App;
