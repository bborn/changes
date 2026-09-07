import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { serializeSong } from "../songs.js";

let dismissActive;
function showDialog(Component, props, returnSelector) {
  dismissActive?.();
  const opener = document.activeElement;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (dismissActive === close) dismissActive = null;
    queueMicrotask(() => {
      root.unmount();
      host.remove();
      if (!document.querySelector("dialog[open]"))
        (opener?.isConnected
          ? opener
          : document.querySelector(returnSelector)
        )?.focus({ preventScroll: true });
    });
  };
  dismissActive = close;
  root.render(<Component {...props} onClose={close} />);
}
function useModal(ref) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector("input")?.focus();
  }, [ref]);
}
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const popular = [
  "autumn leaves",
  "fly me to the moon",
  "all of me",
  "the girl from ipanema",
  "blue bossa",
  "all the things you are",
  "there will never be another you",
  "summertime",
  "take the a train",
  "chameleon",
];
function SongLibrary({ songs, onSelect, onWrite, onClose }) {
  const ref = useRef(null),
    results = useRef(null);
  useModal(ref);
  const [query, setQuery] = useState(""),
    [melodyOnly, setMelodyOnly] = useState(false);
  const indexed = useMemo(
    () =>
      songs
        .filter((song) => !song.originalSlug)
        .map((song) => ({
          song,
          title: normalize(song.title),
          search: normalize(
            `${song.title} ${song.composer || ""} ${song.custom ? "my songs" : ""}`,
          ),
        })),
    [songs],
  );
  const matches = useMemo(() => {
    const text = normalize(query),
      words = text.split(" ").filter(Boolean);
    let list = indexed.filter(
      (entry) =>
        words.every((word) => entry.search.includes(word)) &&
        (!melodyOnly || entry.song.hasMelody),
    );
    return list.sort((a, b) =>
      words.length
        ? Number(b.title.startsWith(text)) - Number(a.title.startsWith(text)) ||
          a.song.title.localeCompare(b.song.title)
        : (popular.indexOf(a.title) < 0 ? 999 : popular.indexOf(a.title)) -
            (popular.indexOf(b.title) < 0 ? 999 : popular.indexOf(b.title)) ||
          Number(Boolean(b.song.custom)) - Number(Boolean(a.song.custom)) ||
          a.song.title.localeCompare(b.song.title),
    );
  }, [indexed, query, melodyOnly]);
  const choose = (song) => {
    onClose();
    onSelect(
      melodyOnly ? song.melodyVersion || song.slug : song.slug,
      melodyOnly,
    );
  };
  return (
    <dialog
      ref={ref}
      className="song-library"
      aria-labelledby="song-library-title"
      onClose={onClose}
    >
      <header>
        <div>
          <h2 id="song-library-title">Find a song</h2>
          <p>{indexed.length.toLocaleString()} charts, ready to play.</p>
        </div>
        <button
          className="library-close"
          aria-label="Close song library"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <label className="library-search-label">
        Search by title or composer
        <input
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Try Fly Me to the Moon"
          aria-controls="song-search-results"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              results.current.querySelector("button")?.focus();
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches[0]) choose(matches[0].song);
            }
          }}
        />
      </label>
      <label className="melody-filter">
        <input
          type="checkbox"
          checked={melodyOnly}
          onChange={(e) => setMelodyOnly(e.target.checked)}
        />{" "}
        With melody
      </label>
      <p className="library-result-count" aria-live="polite">
        {query.trim() || melodyOnly
          ? `${matches.length.toLocaleString()} ${matches.length === 1 ? "song" : "songs"} found${matches.length > 50 ? " · Showing the first 50" : ""}`
          : "A few favorites to get you started"}
      </p>
      <div id="song-search-results" className="library-results" ref={results}>
        {matches.length ? (
          matches.slice(0, 50).map(({ song }) => (
            <button
              key={song.slug}
              className="library-result"
              data-slug={song.slug}
              onClick={() => choose(song)}
            >
              <span>
                <b>{song.title}</b>
                {song.composer && <small>{song.composer}</small>}
              </span>
              <span className="result-meta">
                {song.hasMelody ? "♪ Melody · " : ""}
                {song.key} · {song.style}
                <span aria-hidden="true"> →</span>
              </span>
            </button>
          ))
        ) : (
          <p className="library-empty">
            No matching songs. Try a different title or composer, or write your
            own chart below.
          </p>
        )}
      </div>
      <p className="library-credit">
        <a href="/credits.html" target="_blank" rel="noopener">
          Chart sources &amp; credits
        </a>
      </p>
      <footer>
        <span>Have something else in mind?</span>
        <button
          className="write-song"
          onClick={() => {
            onClose();
            onWrite();
          }}
        >
          Write your own
        </button>
      </footer>
    </dialog>
  );
}
function SongEditor({ tune, onSave, onImport, onClose }) {
  const ref = useRef(null),
    fileRef = useRef(null),
    alive = useRef(true);
  useModal(ref);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [fields, setFields] = useState(() =>
    tune
      ? serializeSong(tune)
      : {
          title: "",
          key: "C",
          tempo: 120,
          style: "swing",
          form: "",
          chart: "",
        },
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const field = (name) => ({
    name,
    value: fields[name] ?? "",
    onChange: (e) => setFields((old) => ({ ...old, [name]: e.target.value })),
  });
  const run = async (task) => {
    setError("");
    setBusy(true);
    try {
      await task();
      if (alive.current) onClose();
    } catch (problem) {
      if (alive.current) setError(problem.message || String(problem));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return (
    <dialog
      ref={ref}
      className="song-editor"
      aria-labelledby="song-editor-title"
      onClose={onClose}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => onSave(fields));
        }}
      >
        <header>
          <h2 id="song-editor-title">{tune ? "Edit song" : "Add a song"}</h2>
          <button
            type="button"
            className="editor-close"
            aria-label="Close song editor"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <p className="editor-description">
          Saved to your library.
        </p>
        <label>
          Song title
          <input
            {...field("title")}
            required
            maxLength={100}
            placeholder="My jazz standard"
          />
        </label>
        <div className="editor-fields">
          <label>
            Key
            <input {...field("key")} required placeholder="C or Gm" />
          </label>
          <label>
            Tempo
            <input
              {...field("tempo")}
              type="number"
              min={40}
              max={240}
              required
            />
          </label>
          <label>
            Style
            <select {...field("style")}>
              {["swing", "bossa", "funk", "ballad"].map((value) => (
                <option key={value} value={value}>
                  {value[0].toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Chord chart
          <textarea
            {...field("chart")}
            rows={8}
            required
            spellCheck={false}
            aria-describedby="chart-instructions"
            placeholder={"A:\nDm7 | G7 | Cmaj7 | Cmaj7"}
          />
        </label>
        <p id="chart-instructions" className="field-hint">
          Start each section with a name and colon, such as A:. Separate bars
          with |. Put two chords in one bar with a space.
        </p>
        <label>
          Section order <span className="optional">optional</span>
          <input
            {...field("form")}
            placeholder="A A B A"
            aria-describedby="form-instructions"
          />
        </label>
        <p id="form-instructions" className="field-hint">
          Leave blank to play each section once, in chart order.
        </p>
        <p className="editor-error" role="alert" hidden={!error}>
          {error}
        </p>
        <div className="editor-actions">
          <button
            type="button"
            className="import-song"
            disabled={busy}
            onClick={() => fileRef.current.click()}
          >
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="song-file"
            aria-label="Choose a song JSON file"
            hidden
            onChange={(e) => {
              const file = e.target.files[0];
              e.target.value = "";
              if (file)
                run(async () => {
                  if (file.size > 1024 * 1024)
                    throw Error("Choose a JSON file smaller than 1 MB.");
                  const parsed = JSON.parse(await file.text());
                  if (alive.current) await onImport(parsed);
                });
            }}
          />
          <div>
            <button type="button" className="cancel-song" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="save-song" disabled={busy}>
              Save song
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
export const openSongLibrary = (props) =>
  showDialog(SongLibrary, props, "[data-add-song]");
export const openSongEditor = (props) =>
  showDialog(
    SongEditor,
    props,
    props.tune ? "[data-band-open]" : "[data-add-song]",
  );
