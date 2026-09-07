import {notePc,noteName} from './theory.js';
export function transposeChord(symbol,semitones){
 if(symbol==='N.C.')return symbol;
 return symbol.replace(/^([A-G][#b]?)/,root=>noteName(notePc(root)+semitones)).replace(/\/([A-G][#b]?)$/,(_,bass)=>'/'+noteName(notePc(bass)+semitones));
}
export function transposeTune(tune,key){
 const shift=notePc(key.replace(/m$/,''))-notePc(tune.key.replace(/m$/,''));
 return {...tune,key,sections:Object.fromEntries(Object.entries(tune.sections).map(([id,section])=>[id,{...section,...(section.scaleHint?{scaleHint:{primary:transposeChord(section.scaleHint.primary,shift),...(section.scaleHint.alt?{alt:transposeChord(section.scaleHint.alt,shift)}:{}),notes:'Use the highlighted chord tones as the harmony changes.'}}:{}),...(section.melody?{melody:section.melody.map(bar=>bar.map(event=>({...event,midi:event.midi===null?null:event.midi+shift})))}:{}),bars:section.bars.map(bar=>bar.map(chord=>transposeChord(chord,shift)))}]))};
}
