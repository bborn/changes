export function phraseBarEvents(notes, beats, offset) {
  const clipped = notes
    .map((note) => ({
      ...note,
      beat: note.writtenBeat ?? note.beat,
      duration: note.writtenDuration ?? note.duration,
    }))
    .filter(
      (note) => note.beat + note.duration > offset && note.beat < offset + beats,
    )
    .map((note) => ({
      midi: note.pitch,
      beat: Math.max(0, note.beat - offset),
      duration:
        Math.min(note.beat + note.duration, offset + beats) -
        Math.max(note.beat, offset),
      tie: note.tie || note.beat < offset,
    }))
    .sort((a, b) => a.beat - b.beat);
  const events = [];
  let cursor = 0;
  for (const note of clipped) {
    if (note.beat > cursor)
      events.push({ midi: null, beat: cursor, duration: note.beat - cursor });
    events.push(note);
    cursor = Math.max(cursor, note.beat + note.duration);
  }
  if (cursor < beats)
    events.push({ midi: null, beat: cursor, duration: beats - cursor });
  return events;
}
