import library from '../data/voicings.js';

export const TUNING = [40, 45, 50, 55, 59, 64]; // strings 6 through 1, MIDI
const NAMES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const NATURAL = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
export const mod12 = value => ((value % 12) + 12) % 12;
export const noteName = pc => NAMES[mod12(pc)];
export function notePc(name) {
  const match = /^([A-G])([#b]?)$/.exec(name.replaceAll('♭','b').replaceAll('♯','#'));
  if (!match) throw new Error(`Invalid note: ${name}`);
  return mod12(NATURAL[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0));
}
const QUALITY_ALIASES = {
  maj9:['maj7','9'],maj13:['maj7','13'],m9:['m7','9'],m11:['m7','9','11'],m13:['m7','9','13'],
  mMaj9:['mMaj7','9'],'9':['7','9'],'11':['7','9','11'],'13':['7','13'],
  '9sus4':['7sus4','9'],'13sus4':['7sus4','13'],
};
export function parseChord(symbol) {
  if (typeof symbol !== 'string' || symbol.length > 64) throw new Error('Chord must be a string of at most 64 characters');
  if(symbol==='N.C.')return {root:'C',rootPc:0,quality:'rest',extensions:[],bass:null};
  const match = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(symbol.trim().replaceAll('♭','b').replaceAll('♯','#'));
  if (!match) throw new Error(`Unsupported chord: ${symbol}`);
  const suffix = match[2];
  const qualityMatch = /^(m7b5|mMaj9|mMaj7|dimMaj7|maj13|maj9|maj7|m13|m11|m9|m7|m6|mb6|dim7|dim|aug7|aug|13sus4|9sus4|7sus4|sus4|sus2|maj|m|13|11|9|7|6|5|alt)?/.exec(suffix);
  let quality = qualityMatch[0] || 'maj';
  let rest = suffix.slice(qualityMatch[0].length);
  let extensions = [];
  if (QUALITY_ALIASES[quality]) [quality, ...extensions] = QUALITY_ALIASES[quality];
  if (quality === 'alt') { quality='7'; extensions.push('b9','#9','b5','#5'); }
  while (rest) {
    const token = /^(add9|add3|b13|#11|b9|#9|b5|#5|alt)/.exec(rest)?.[0];
    if (!token) throw new Error(`Unsupported chord: ${symbol}`);
    if (token === 'alt') extensions.push('b9','#9','b5','#5');
    else extensions.push(token === 'add9' ? '9' : token);
    rest = rest.slice(token.length);
  }
  return {root:match[1],rootPc:notePc(match[1]),quality,extensions:[...new Set(extensions)],bass:match[3] || null};
}
export const INTERVALS = {
  rest:[],5:[0,7],maj:[0,4,7],m:[0,3,7],maj7:[0,4,7,11],m7:[0,3,7,10],7:[0,4,7,10],
  mMaj7:[0,3,7,11],m7b5:[0,3,6,10],dim:[0,3,6],dim7:[0,3,6,9],dimMaj7:[0,3,6,11],
  aug:[0,4,8],aug7:[0,4,8,10],6:[0,4,7,9],m6:[0,3,7,9],mb6:[0,3,7,8],
  sus4:[0,5,7],sus2:[0,2,7],'7sus4':[0,5,7,10],
};
const EXTENSIONS = {'9':2,'11':5,'13':9,b9:1,'#9':3,'#11':6,b5:6,'#5':8,b13:8,add3:4};
function chordIntervals(chord) {
  let intervals = [...INTERVALS[chord.quality]];
  if (chord.extensions.includes('b5') || chord.extensions.includes('#5')) intervals = intervals.filter(n => n !== 7);
  intervals.push(...chord.extensions.map(ext => EXTENSIONS[ext]));
  // Upper extensions imply an available ninth, but an altered ninth replaces it.
  if (chord.extensions.includes('13') || chord.extensions.includes('#11')) intervals.push(2);
  if (chord.extensions.includes('b9') || chord.extensions.includes('#9')) intervals = intervals.filter(n => n !== 2);
  return [...new Set(intervals)];
}
export function chordPitchClasses(symbol) {
  const chord = typeof symbol === 'string' ? parseChord(symbol) : symbol;
  const pitches = chordIntervals(chord).map(n => mod12(chord.rootPc+n));
  if (chord.bass) pitches.push(notePc(chord.bass));
  return [...new Set(pitches)];
}
function toneLabel(interval, chord) {
  for (const ext of chord.extensions) if (EXTENSIONS[ext] === interval) return ext === 'add3' ? '3' : ext;
  return ({0:'R',1:'b9',2:chord.quality==='sus2'?'2':'9',3:INTERVALS[chord.quality].includes(3)?'b3':'#9',4:'3',5:'4',
    6:chord.quality.includes('dim')||chord.quality==='m7b5'?'b5':'#11',7:'5',8:chord.quality==='mb6'?'b6':'#5',
    9:chord.quality==='dim7'?'bb7':'6',10:'b7',11:'7'})[interval];
}
const VOICING_CACHE = new Map();
export function getVoicings(symbol) {
  if(symbol==='N.C.')return [];
  if (VOICING_CACHE.has(symbol)) return VOICING_CACHE.get(symbol);
  const chord = parseChord(symbol);
  const extension = chord.extensions[0];
  // Only exact static-template matches are safe: Cmaj9 must never use a C9 shape.
  const quality = !extension ? chord.quality : chord.quality === '7' && chord.extensions.length === 1
    ? (['9','13'].includes(extension) ? extension : `7${extension}`) : null;
  const templates = !chord.bass && library.filter(v => v.quality === quality);
  const result = templates?.length ? templateVoicings(chord, templates) : searchVoicings(chord);
  // Consumers treat voicings as immutable; cached results avoid repeated fretboard searches.
  for (const voicing of result) { for (const value of Object.values(voicing)) if (Array.isArray(value)) Object.freeze(value); Object.freeze(voicing); }
  Object.freeze(result);
  VOICING_CACHE.set(symbol,result);
  return result;
}
function templateVoicings(chord, templates) {
  return templates.map(voicing => {
    const anchor = 6 - voicing.rootString;
    let rootFret = mod12(chord.rootPc - TUNING[anchor]);
    const minimumOffset = Math.min(...voicing.fretsFromRoot.filter(f => f !== null));
    while (rootFret + minimumOffset < 1) rootFret += 12;
    while (rootFret - 12 + minimumOffset >= 1) rootFret -= 12;
    let frets = voicing.fretsFromRoot.map(f => f === null ? null : f + rootFret);
    const tones = frets.map((f,i)=>f===null?'':toneLabel(mod12(TUNING[i]+f-chord.rootPc),chord));
    return {name:`${voicing.name} · fret ${voicing.fretsFromRoot[anchor] === 0 ? rootFret : Math.min(...frets.filter(f => f !== null))}`,rootString:voicing.rootString,frets,
      fingers:[...voicing.fingers],tones,notes:frets.map((f,i)=>f===null?'':noteName(TUNING[i]+f)),
      pitches:frets.flatMap((f,i)=>f===null?[]:[TUNING[i]+f])};
  });
}
// Four-note comping shapes prioritize the third/suspension, seventh and written
// colors. In extended chords the bassist supplies the root; the fifth is optional.
function requiredIntervals(chord) {
  const all = chordIntervals(chord);
  const base = INTERVALS[chord.quality];
  const guide = base.filter(n => n !== 0 && n !== 7 && n !== 8 && n !== 6);
  const altered = chord.extensions.filter(ext=>['b5','#5','b9','#9','#11','b13','add3'].includes(ext)).map(ext=>EXTENSIONS[ext]);
  const colors = chord.extensions.filter(ext=>['11','13','9'].includes(ext)).map(ext=>EXTENSIONS[ext]).reverse();
  const structural = base.filter(n=>n===6||n===8);
  const priority = [...new Set([...guide,...altered,...structural,...colors])].filter(n=>all.includes(n));
  if (all.length <= 4 && !chord.bass) return all;
  const capacity = chord.bass ? 3 : 4;
  if (priority.length < capacity) priority.push(0);
  return [...new Set(priority)].slice(0,capacity);
}
function searchVoicings(chord) {
  const bassPc = chord.bass ? notePc(chord.bass) : null;
  const allowed = chordPitchClasses({...chord,bass:null});
  const required = requiredIntervals(chord).map(n=>mod12(chord.rootPc+n));
  const choices = [], seen = new Set();
  const stringSets = [[0,2,3,4],[0,3,4,5],[1,2,3,4],[1,3,4,5],[2,3,4,5],[0,1,2,3],[1,2,4,5],[0,2,4,5]];
  for (let start=1; start<=15; start++) {
    for (const strings of stringSets) {
      const bassString = strings[0];
      if (chord.bass && bassString > 1) continue;
      const candidates = strings.map((string,index)=>Array.from({length:5},(_,i)=>start+i)
        .filter(f=>index===0 && chord.bass ? mod12(TUNING[string]+f)===bassPc : allowed.includes(mod12(TUNING[string]+f))));
      const visit = (frets,index) => {
        if (index < strings.length) {
          for (const fret of candidates[index]) visit([...frets,fret],index+1);
          return;
        }
        const pitches=frets.map((f,i)=>TUNING[strings[i]]+f);
        if (chord.bass && pitches[0] >= Math.min(...pitches.slice(1))) return;
        if (!required.every(pc=>pitches.some(p=>mod12(p)===pc))) return;
        const full=Array(6).fill(null);strings.forEach((string,i)=>full[string]=frets[i]);
        const key=full.join(',');if(seen.has(key))return;seen.add(key);
        const span=Math.max(...frets)-Math.min(...frets);
        choices.push({full,pitches,bassString,score:span*2+Math.min(...frets)*0.3});
      };
      visit([],0);
    }
  }
  return choices.sort((a,b)=>a.score-b.score).slice(0,3).map(({full,pitches,bassString})=>{
    const rootIndex=full.findIndex((f,i)=>f!==null && mod12(TUNING[i]+f)===chord.rootPc);
    const ordered=full.map((f,i)=>({f,i})).filter(({f})=>f!==null).sort((a,b)=>a.f-b.f);
    const fingers=Array(6).fill(null);ordered.forEach(({i},finger)=>fingers[i]=finger+1);
    return {name:chord.bass ? `${chord.bass} bass on string ${6-bassString} · fret ${full[bassString]}` : `Compact voicing · fret ${ordered[0].f}`,
      rootString:rootIndex<0?0:6-rootIndex,frets:full,fingers,pitches,
      tones:full.map((f,i)=>f===null?'':toneLabel(mod12(TUNING[i]+f-chord.rootPc),chord)),
      notes:full.map((f,i)=>f===null?'':noteName(TUNING[i]+f))};
  });
}
const SCALE_INTERVALS = {
  major:[0,2,4,5,7,9,11],ionian:[0,2,4,5,7,9,11],lydian:[0,2,4,6,7,9,11],
  minor:[0,2,3,5,7,8,10],'natural minor':[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],
  mixolydian:[0,2,4,5,7,9,10],locrian:[0,1,3,5,6,8,10],'locrian ♮2':[0,2,3,5,6,8,10],
  altered:[0,1,3,4,6,8,10],'whole-half diminished':[0,2,3,5,6,8,9,11],
  'half-whole diminished':[0,1,3,4,6,7,9,10],'harmonic minor':[0,2,3,5,7,8,11],
  'melodic minor':[0,2,3,5,7,9,11],'minor pentatonic':[0,3,5,7,10],'minor blues':[0,3,5,6,7,10],
  'lydian dominant':[0,2,4,6,7,9,10],
};
export function scalePitchClasses(name) {
  const match = /^([A-G][b#♭♯]?)\s+(.+)$/.exec(name);
  const intervals = match && SCALE_INTERVALS[match[2].toLowerCase()];
  if (!intervals) throw new Error(`Unsupported scale: ${name}`);
  return intervals.map(n => mod12(notePc(match[1])+n));
}
