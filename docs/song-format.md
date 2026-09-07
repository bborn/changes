# Local song format

A tune is a JSON object. Use an array of these objects for a multi-song import.

Required metadata: `slug` (lowercase letters, digits and hyphens), `title`, `key` (such as C or Gm), `tempo` (40–240 quarter-note BPM), `style` (swing, bossa, funk, ballad), `timeSignature`, `form`, and `sections`.

`form` is an ordered array of section IDs; repeating an ID repeats that section. Each section has a `label` and `bars`: an array of bars, each containing chord-symbol strings. Use `N.C.` for no chord. Chords divide the bar evenly by default. Optional `barDurations` parallels `bars`; each duration is positive and the bar total equals the meter numerator.

Optional `melody` parallels the section's bars. Each bar contains events with `midi` (integer guitar-range pitch, or null for a rest), `beat` (zero-based), and `duration`. Timing units are the meter's denominator beats, not seconds. Preserve rests and ensure events fill each bar. Tied continuation events may include `tie: true`. See `backend/validation.js` for exact limits and validation.

Retain `sources` links and `attribution`; melody editions can include `melodySource` with a source URL and collection information. Use separate tune editions when the source melody's intro, form or harmony differs from another chart. Only set `originalSlug`/`melodyVersion` links when the referenced files exist.

`validateTune` expects editable slugs beginning with `custom-`; the command-line importer validates static tunes using a temporary prefix while preserving their filenames. Importers should call the validator before saving. The compact fixtures in `tests/fixtures/` illustrate event shape using artificial test material.

No tune payloads belong in Git. Put local tunes in `tunes/`; it is ignored except for its empty directory marker. Generated `tunes/index.json` is also ignored.
