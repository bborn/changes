import React from "react";
import { mod12, noteName } from "../theory.js";

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export function keyboardRange(notes = []) {
  const pitches = notes.map((note) => note.pitch).filter(Number.isFinite);
  if (!pitches.length) return [60, 71];
  return [
    Math.floor(Math.min(...pitches) / 12) * 12,
    Math.ceil((Math.max(...pitches) + 1) / 12) * 12 - 1,
  ];
}

export function Keyboard({
  notes = [],
  activePitch,
  onNote,
  label = "Piano keyboard",
}) {
  const byPitch = new Map(notes.map((note) => [note.pitch, note]));
  const [low, high] = keyboardRange(notes);
  const keys = Array.from(
    { length: high - low + 1 },
    (_, index) => low + index,
  );

  return (
    <div className="keyboard" role="group" aria-label={label}>
      {keys.map((pitch) => {
        const note = byPitch.get(pitch);
        const black = BLACK_KEYS.has(mod12(pitch));
        return (
          <button
            type="button"
            key={pitch}
            className={`piano-key ${black ? "black" : "white"}${note ? ` ${note.role || "chord"}` : ""}${note?.next ? " next" : ""}${activePitch === pitch ? " active" : ""}`}
            disabled={!note}
            data-pitch={pitch}
            onClick={() => note && onNote?.(pitch)}
            aria-label={
              note
                ? `Hear ${note.label || noteName(pitch)}${note.next ? ", next target" : ""}`
                : noteName(pitch)
            }
            aria-pressed={activePitch === pitch}
          >
            {note && <span>{note.label || noteName(pitch)}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function NoteNames({
  notes = [],
  activePitch,
  onNote,
  label = "Notes",
}) {
  return (
    <div className="note-names" role="group" aria-label={label}>
      {notes.map((note) => (
        <button
          type="button"
          key={note.pitch}
          className={`${note.role || "chord"}${note.next ? " next" : ""}${activePitch === note.pitch ? " active" : ""}`}
          onClick={() => onNote?.(note.pitch)}
          aria-pressed={activePitch === note.pitch}
        >
          {note.label || noteName(note.pitch)}
          {note.next && <span className="visually-hidden">, next target</span>}
        </button>
      ))}
    </div>
  );
}
