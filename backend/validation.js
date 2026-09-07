import {parseChord} from '../src/theory.js';
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
export function validateTune(value,{allowReview=false}={}){
 if(!value||typeof value!=='object'||!/^custom-[a-zA-Z0-9-]{1,100}$/.test(value.slug))fail('Invalid song ID.');
 if(typeof value.title!=='string'||!value.title.trim()||value.title.length>100)fail('Add a song title.');
 if(!/^[A-G][#b]?m?$/.test(value.key)||!['swing','bossa','funk','ballad'].includes(value.style)||!Number.isFinite(value.tempo)||value.tempo<40||value.tempo>240)fail('Invalid song settings.');
 if(!/^(?:[1-9]|1[0-2])\/(?:2|4|8)$/.test(value.timeSignature))fail('Invalid time signature.');
 const beats=Number(value.timeSignature.split('/')[0]);
 if(!Array.isArray(value.form)||!value.form.length||value.form.length>128||!value.sections)fail('Invalid song form.');
 const sections={};let total=0;
 for(const id of new Set(value.form)){
  if(typeof id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(id))fail('Invalid section.');
  const s=value.sections[id];if(!s||!Array.isArray(s.bars)||!s.bars.length||s.bars.length>128)fail('Invalid bars.');
  const bars=s.bars.map(bar=>{if(!Array.isArray(bar)||!bar.length||bar.length>12)fail('Invalid chords.');return bar.map(c=>{if(typeof c!=='string'||c.length>40)fail('Invalid chord.');try{parseChord(c);}catch{fail('Unrecognized chord: '+c);}return c;});});
  const result={label:id,bars};
  if(s.barDurations){if(s.barDurations.length!==bars.length)fail('Invalid chord timing.');result.barDurations=s.barDurations.map((ds,i)=>{if(ds.length!==bars[i].length||ds.some(d=>!Number.isFinite(d)||d<=0)||Math.abs(ds.reduce((a,b)=>a+b,0)-beats)>.001)fail('Chord timing must fill the bar.');return ds;});}
  if(s.melody){if(!Array.isArray(s.melody)||s.melody.length!==bars.length)fail('Melody must match the chart bars.');result.melody=s.melody.map((events,i)=>{if(!Array.isArray(events)||!events.length||events.length>64)fail('Invalid melody.');let end=0;const clean=events.map(e=>{if(!Number.isFinite(e.beat)||!Number.isFinite(e.duration)||e.duration<=0||Math.abs(e.beat-end)>.001||e.beat+e.duration>(allowReview?beats*4:beats)+.001||e.midi!==null&&(!Number.isInteger(e.midi)||e.midi<40||e.midi>83))fail(`Check melody timing or pitch in bar ${i+1}.`);end=e.beat+e.duration;return {beat:e.beat,duration:e.duration,midi:e.midi,uncertain:Boolean(e.uncertain),tie:Boolean(e.tie)};});if(!allowReview&&Math.abs(end-beats)>.001)fail(`Melody must fill bar ${i+1}; add rests where needed.`);return clean;});}
  Object.defineProperty(sections,id,{value:result,enumerable:true});
 }
 for(const id of value.form)total+=sections[id].bars.length;if(total>512)fail('Song is too long.');
 return {slug:value.slug,custom:true,title:value.title.trim(),key:value.key,tempo:value.tempo,style:value.style,timeSignature:value.timeSignature,form:value.form,sections,...(value.scanId&&/^[a-f0-9-]{36}$/.test(value.scanId)?{scanId:value.scanId}:{}),...(Object.values(sections).some(s=>s.melody)?{melodyNotes:'Scanned melody · review pitches and rhythm before practicing.'}:{})};
}
export function scanDraft(raw,id,{allowReview=false}={}){
 if(!raw||!Array.isArray(raw.bars)||!raw.bars.length||raw.bars.length>128)fail('No readable music found. Try a closer, straight-on photo.');
 const beats=Number((raw.timeSignature||'4/4').split('/')[0]);
 const tune={slug:'custom-'+id,title:raw.title||'Scanned chart',key:String(raw.key||'C').replaceAll('♭','b').replaceAll('♯','#').replace(/\s+major$/i,'').replace(/\s+minor$/i,'m').trim(),tempo:80,style:'swing',timeSignature:raw.timeSignature||'4/4',form:['A'],sections:{A:{bars:raw.bars.map(b=>b.chords?.length?b.chords:['N.C.']),melody:raw.bars.map(b=>b.notes)}} ,scanId:id};
 // Preserve uncertainty and reject incomplete bars instead of inventing missing notes.
 for(const bar of tune.sections.A.melody){if(!Array.isArray(bar))fail('Melody could not be read. Try one line at a time.');let beat=0;for(const note of bar){note.beat=beat;beat+=note.duration;}if(Math.abs(beat-beats)>.001){if(!allowReview)fail('Some rhythms were unclear. Try a closer photo of one line.');for(const note of bar)note.uncertain=true;}}
 const pitches=tune.sections.A.melody.flat().filter(n=>n.midi!==null).map(n=>n.midi);if(!pitches.length)fail('No readable melody found.');
 let shift=0;while(Math.max(...pitches)+shift>83)shift-=12;while(Math.min(...pitches)+shift<40)shift+=12;
 if(Math.max(...pitches)+shift>83)fail('Melody range is too wide for this guitar view.');
 if(shift)for(const note of tune.sections.A.melody.flat())if(note.midi!==null)note.midi+=shift;
 return validateTune(tune,{allowReview});
}
