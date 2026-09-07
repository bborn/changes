import {INTERVALS,chordPitchClasses} from '../src/theory.js';
const qualities=[...Object.keys(INTERVALS).filter(q=>q!=='rest'),'maj9','maj13','m9','m11','m13','mMaj9','9','11','13','9sus4','13sus4'];
const rows=[];
const alterations=['b9','#9','b5','#5','b13','#11','add9'];
const extensions=['',...alterations,...alterations.flatMap(a=>alterations.filter(b=>b!==a).map(b=>a+b))];
for(const q of qualities)for(const extension of extensions){
 const symbol='C'+(q==='maj'?'':q)+extension;
 try{rows.push([symbol.slice(1),chordPitchClasses(symbol).sort((a,b)=>a-b)]);}catch{}
}
process.stdout.write(JSON.stringify(rows));
