const NATURAL={C:0,D:2,E:4,F:5,G:7,A:9,B:11},LETTERS='CDEFGAB';
const pc=name=>(NATURAL[name[0]]+(name[1]==='#'?1:name[1]==='b'?-1:0)+12)%12;
const SHARP_KEYS=new Set(['G','D','A','E','B','F#','C#','Em','Bm','F#m','C#m','G#m','D#m','A#m']);
/** Spell pitches against the key signature; stored MIDI lacks original engraving spelling. */
export function spellPitch(midi,key='C'){
 const minor=key.endsWith('m'),root=key.replace(/m$/,''),start=LETTERS.indexOf(root[0]),scale=minor?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];
 const pitch=(midi%12+12)%12;
 if(minor && pitch===(pc(root)+11)%12)scale[6]=11;
 const degree=scale.findIndex(interval=>(pc(root)+interval)%12===pitch);
 let name;
 if(degree>=0){const letter=LETTERS[(start+degree)%7];let delta=(pitch-NATURAL[letter]+12)%12;if(delta>6)delta-=12;name=letter+(delta>0?'#'.repeat(delta):'b'.repeat(-delta));}
 else name=(SHARP_KEYS.has(key)?['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']:['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'])[pitch];
 // Resolve B#/Cb across octave boundaries using the actual sounding MIDI pitch.
 const alteration=[...name.slice(1)].reduce((n,c)=>n+(c==='#'?1:-1),0),octave=Math.round((midi-NATURAL[name[0]]-alteration)/12)-1;
 return {name,octave,key:name.toLowerCase()+'/'+octave};
}
const BASES=[4,2,1,.5,.25,.125,.0625,.03125];
/** Decompose into readable durations; tuplets retain exact musical time. */
export function rhythmParts(duration,beatValue=4){
 let remaining=duration*4/beatValue;const parts=[];
 const options=BASES.flatMap(base=>[0,1,2].map(dots=>({base,dots,quarters:base*(2-2**(-dots)),ratio:1}))).sort((a,b)=>b.quarters-a.quarters);
 for(let guard=0;remaining>1e-5&&guard<64;guard++){
  let part=options.find(p=>Math.abs(p.quarters-remaining)<.0001);
  if(!part)for(const ratio of [3/2,5/4,7/4]){const found=options.find(p=>Math.abs(p.quarters/ratio-remaining)<.0001);if(found){part={...found,quarters:found.quarters/ratio,ratio};break;}}
  if(!part)part=options.find(p=>p.quarters<remaining+.00001);
  if(!part)throw Error('This rhythm needs a smaller note value.');
  parts.push({...part,duration:String(4/part.base)});remaining-=part.quarters;
 }
 if(remaining>1e-5)throw Error('This rhythm could not be notated.');return parts;
}
export function notationEvents(events,key,meter){
 const beatValue=Number(meter.split('/')[1]);
 return events.flatMap((event,index)=>{let beat=event.beat;return rhythmParts(event.duration,beatValue).map((rhythm,partIndex)=>{const item={...event,index,...rhythm,beat,durationBeats:rhythm.quarters*beatValue/4,continued:Boolean(event.tie||partIndex),pitch:event.midi===null?null:spellPitch(event.midi,key)};beat+=item.durationBeats;return item;});});
}
