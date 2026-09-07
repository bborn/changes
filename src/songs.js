import { parseChord, scalePitchClasses } from './theory.js';

export const SONGS_STORAGE_KEY = 'pocket-session-songs';
const STYLES = ['swing', 'bossa', 'funk', 'ballad'];
const SECTION_ID = /^[A-Za-z][A-Za-z0-9_-]{0,15}$/;
const CUSTOM_SLUG = /^custom-[A-Za-z0-9_-]{1,100}$/;
const MAX_BARS = 512;
const normalize = value => value.replaceAll('♭', 'b').replaceAll('♯', '#');
const fail = message => { throw new Error(message); };
const defaultStorage = () => globalThis.localStorage;

/** Convert the song editor's plain text into a validated, playable custom tune. */
export function parseSong({title, key, tempo, style, form, chart} = {}, slug) {
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 100) fail('Title must contain 1–100 characters.');
  if (typeof key !== 'string' || key.length > 20) fail('Key must be a note followed by optional m, major, or minor (for example C or Bb minor).');
  const keyMatch = /^([A-Ga-g][b#]?)(?:\s*(m|major|minor))?$/.exec(normalize(key.trim()));
  if (!keyMatch) fail('Key must be a note followed by optional m, major, or minor (for example C or Bb minor).');
  const normalizedKey = keyMatch[1][0].toUpperCase() + keyMatch[1].slice(1) + (['m','minor'].includes(keyMatch[2]) ? 'm' : '');
  if ((typeof tempo !== 'number' && typeof tempo !== 'string') || (typeof tempo === 'string' && !tempo.trim()) || !Number.isFinite(Number(tempo)) || Number(tempo) < 40 || Number(tempo) > 240) fail('Tempo must be a number from 40 to 240 BPM.');
  if (!STYLES.includes(style)) fail('Style must be swing, bossa, funk, or ballad.');
  if (typeof chart !== 'string' || !chart.trim()) fail('Chart is required. Start a section with A: and separate bars with |.');
  if (chart.length > 100000) fail('Chart is too long (maximum 100,000 characters).');
  if (slug !== undefined && (typeof slug !== 'string' || !CUSTOM_SLUG.test(slug))) fail('Custom song IDs must start with custom-.');
  const sections = {};
  let current = null, total = 0;
  const addBars = line => {
    if (!current) fail('Chart must start with a section heading, for example A:.');
    // Optional edge pipes make pasted chart rows convenient; empty interior bars are errors.
    const row = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    for (const part of row.split('|')) {
      const barNumber = sections[current].bars.length + 1;
      if (!part.trim()) fail(`Section ${current}, bar ${barNumber}: empty bars are not allowed.`);
      const chords = part.trim().split(/\s+/).map(normalize);
      if (![1,2,4].includes(chords.length)) fail(`Section ${current}, bar ${barNumber}: use 1, 2, or 4 chords per bar.`);
      for (const chord of chords) {
        try { parseChord(chord); }
        catch { fail(`Section ${current}, bar ${barNumber}: unsupported chord “${chord}”.`); }
      }
      sections[current].bars.push(chords);
      if (++total > MAX_BARS) fail(`Chart cannot contain more than ${MAX_BARS} bars.`);
    }
  };
  for (const rawLine of chart.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = /^([^:]+):\s*(.*)$/.exec(line);
    if (heading) {
      const id = heading[1].trim();
      if (!SECTION_ID.test(id)) fail('Section names must start with a letter and contain at most 16 letters, numbers, hyphens, or underscores.');
      if (Object.hasOwn(sections, id)) fail(`Section ${id} is declared more than once.`);
      if (Object.keys(sections).length >= 26) fail('Chart cannot contain more than 26 sections.');
      current = id;
      Object.defineProperty(sections, id, {value:{label:id,bars:[]}, enumerable:true, configurable:true, writable:true});
      if (heading[2].trim()) addBars(heading[2]);
    } else addBars(line);
  }
  for (const [id, section] of Object.entries(sections)) if (!section.bars.length) fail(`Section ${id} must contain at least one bar.`);
  if (form !== undefined && typeof form !== 'string') fail('Form must be section names separated by spaces or commas.');
  if (form && form.length > 10000) fail('Form is too long.');
  const order = form?.trim() ? form.trim().split(/[\s,]+/) : Object.keys(sections);
  if (!order.length) fail('Chart must contain at least one section.');
  let playedBars = 0;
  for (const id of order) {
    if (!Object.hasOwn(sections, id)) fail(`Form references unknown section “${id}”.`);
    playedBars += sections[id].bars.length;
  }
  if (playedBars > MAX_BARS) fail(`The complete form cannot exceed ${MAX_BARS} bars.`);
  return {slug:slug ?? `custom-${globalThis.crypto.randomUUID()}`, custom:true, title:title.trim(), key:normalizedKey, tempo:Number(tempo), style, timeSignature:'4/4', form:order, sections};
}

/** Convert a JSON tune into editor fields, checking its structure before joining arrays. */
export function serializeSong(tune) {
  if (!tune || typeof tune !== 'object' || Array.isArray(tune)) fail('Song JSON must be a single song object.');
  for (const field of ['title','key','tempo','style','timeSignature','form','sections']) if (!Object.hasOwn(tune, field)) fail(`Song JSON is missing ${field}.`);
  if (tune.timeSignature !== '4/4') fail('Only 4/4 time is supported.');
  if (!Array.isArray(tune.form) || !tune.form.length || tune.form.length > MAX_BARS || tune.form.some(id=>typeof id !== 'string' || !SECTION_ID.test(id))) fail('Song form must be a nonempty array of section names.');
  if (!tune.sections || typeof tune.sections !== 'object' || Array.isArray(tune.sections)) fail('Song sections must be an object.');
  const entries = Object.entries(tune.sections);
  if (!entries.length || entries.length > 26) fail('Song must contain 1–26 sections.');
  let total = 0;
  const chart = entries.map(([id,section]) => {
    if (!SECTION_ID.test(id)) fail(`Invalid section name “${id}”.`);
    if (!section || !Array.isArray(section.bars) || !section.bars.length) fail(`Section ${id} must contain bars.`);
    total += section.bars.length;
    if (total > MAX_BARS) fail(`Chart cannot contain more than ${MAX_BARS} bars.`);
    const bars = section.bars.map((bar,index) => {
      if (!Array.isArray(bar) || ![1,2,4].includes(bar.length) || bar.some(chord=>typeof chord !== 'string' || !chord.trim() || chord.length > 32 || /[\s|:]/.test(chord))) fail(`Section ${id}, bar ${index+1}: use 1, 2, or 4 chord symbols.`);
      return bar.join(' ');
    });
    return `${id}:\n${bars.join(' | ')}`;
  }).join('\n\n');
  return {title:tune.title,key:tune.key,tempo:tune.tempo,style:tune.style,form:tune.form.join(' '),chart};
}

function canonicalSong(tune, slug) {
  const valid = parseSong(serializeSong(tune), slug);
  for (const [id, section] of Object.entries(tune.sections)) {
    if (section.scaleHint === undefined) continue;
    const hint = section.scaleHint;
    if (!hint || typeof hint !== 'object' || Array.isArray(hint) || typeof hint.primary !== 'string' || typeof hint.notes !== 'string' || hint.notes.length > 1000 || hint.primary.length > 100 || (hint.alt !== undefined && (typeof hint.alt !== 'string' || hint.alt.length > 100))) fail(`Section ${id}: scaleHint requires a primary scale and notes, with an optional alternate scale.`);
    try {
      scalePitchClasses(hint.primary);
      if (hint.alt !== undefined) scalePitchClasses(hint.alt);
    } catch { fail(`Section ${id}: scaleHint contains an unsupported scale.`); }
    valid.sections[id].scaleHint = {primary:hint.primary, notes:hint.notes, ...(hint.alt !== undefined ? {alt:hint.alt} : {})};
  }
  return valid;
}

export function readSongs(storage) {
  try {
    const data = JSON.parse((storage ?? defaultStorage())?.getItem(SONGS_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(data)) return [];
    const songs = new Map();
    for (const tune of data) {
      try {
        if (tune?.custom !== true || !CUSTOM_SLUG.test(tune.slug)) continue;
        const valid = canonicalSong(tune, tune.slug);
        songs.set(valid.slug, valid);
      } catch { /* Ignore an invalid entry without discarding the rest of the collection. */ }
    }
    return [...songs.values()];
  } catch { return []; }
}

export function saveSong(tune, storage) {
  if (tune?.custom !== true || typeof tune.slug !== 'string' || !CUSTOM_SLUG.test(tune.slug)) fail('Only custom songs can be saved; built-in songs cannot be overwritten.');
  const valid = canonicalSong(tune, tune.slug);
  try {
    const target = storage ?? defaultStorage();
    if (!target?.setItem) fail('Storage is unavailable.');
    const songs = readSongs(target).filter(song=>song.slug !== valid.slug);
    songs.push(valid);
    target.setItem(SONGS_STORAGE_KEY, JSON.stringify(songs));
  } catch { fail('Could not save this song. Browser storage may be unavailable or full.'); }
  return valid;
}

export function importSong(value, storage) {
  return saveSong(canonicalSong(value), storage);
}
