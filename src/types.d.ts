export interface Tune { slug:string; title:string; key:string; tempo:number; style:'swing'|'bossa'|'funk'|'ballad'; timeSignature:string; form:string[]; sections:Record<string,{label:string; bars:string[][]; scaleHint?:{primary:string;notes:string;alt?:string}}> }
export interface Chord { root:string; rootPc:number; quality:string; extensions:string[]; bass:string|null }
export interface Voicing { name:string; rootString:number; frets:(number|null)[]; fingers:(number|null)[]; tones:string[]; notes:string[]; pitches:number[] }
export interface ScaleSuggestion { primary:string; alt:string; notes:string }
export interface PlaybackEvent { section:string; formIndex:number; barIndex:number; beat:number; chord:string; countIn:boolean }
// theory.js: parseChord(symbol), getVoicings(symbol):Voicing[], noteName(pc), chordPitchClasses(symbol), scalePitchClasses(name)
// data/scales.js: suggestSection(tune,sectionId):ScaleSuggestion, scaleForChord(symbol,nextSymbol?)
// AudioEngine extends EventTarget: async play(tune,{tempo,loopSection,countIn}), stop(), setTempo(bpm), setLoop(section|null), setTrack(name,{muted?,volume?}), async preview(pitches)
// Events 'beat' and 'bar': CustomEvent<PlaybackEvent>; 'stop'. Track names: bass, drums, chords.
// renderFretboard({startFret,endFret,dots:[{string,fret,label,emphasis}],muted?:number[],label?:string}): string (SVG markup); string 6 = low E.
