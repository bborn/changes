import { parseChord, noteName, mod12, scalePitchClasses, chordPitchClasses } from '../src/theory.js';

export function scaleForChord(symbol, nextSymbol) {
  const chord = parseChord(symbol);
  const root = chord.root;
  let mode = 'major', alternate = 'lydian';
  if (chord.quality === 'm7' || chord.quality === 'm') {mode='dorian';alternate='minor pentatonic';}
  if (chord.quality === 'm6') {mode='melodic minor';alternate='dorian';}
  if (chord.quality === 'm7b5') {mode='locrian';alternate='locrian ♮2';}
  if (chord.quality === 'dim7') {mode='whole-half diminished';alternate='whole-half diminished';}
  if (chord.quality === '7' || chord.quality === 'sus4') {mode='mixolydian';alternate='mixolydian';}
  if (chord.quality === '7' && nextSymbol && mod12(parseChord(nextSymbol).rootPc-chord.rootPc)===5) alternate='altered';
  if (chord.extensions.includes('#11')) {mode='lydian dominant';alternate='altered';}
  if (chord.extensions.includes('b9') || chord.extensions.includes('#9')) {mode='altered';alternate='half-whole diminished';}
  return {primary:`${root} ${mode}`,alt:`${root} ${alternate}`,notes:'Aim for the highlighted chord tones when the harmony changes.'};
}
export function suggestSection(tune, sectionId) {
  const section=tune.sections[sectionId];
  if (!section) throw new Error(`Unknown section: ${sectionId}`);
  if (section.scaleHint) return {alt:section.scaleHint.primary,...section.scaleHint};
  const symbols=section.bars.flat();
  if (!symbols.length) throw new Error('Section has no chords');
  const first=scaleForChord(symbols[0],symbols[1]);
  const candidates=[first.primary, ...Array.from({length:12},(_,pc)=>`${noteName(pc)} major`)];
  const scored=candidates.map(name=>{
    const set=new Set(scalePitchClasses(name));
    return {name,score:symbols.reduce((sum,symbol)=>sum+chordPitchClasses(symbol).filter(pc=>set.has(pc)).length,0)};
  }).sort((a,b)=>b.score-a.score);
  const primary=scored[0].name;
  const scale=new Set(scalePitchClasses(primary));
  const exceptions=[...new Set(symbols.filter(symbol=>chordPitchClasses(symbol).some(pc=>!scale.has(pc))))];
  return {primary,alt:primary===first.primary?first.alt:first.primary,notes:exceptions.length?`A useful home scale; follow the highlighted chord tones on ${exceptions.join(', ')}.`:'One scale covers every chord in this section. Land on the highlighted chord tones.'};
}
