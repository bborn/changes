import {parseChord,chordPitchClasses,mod12,noteName,TUNING} from './theory.js';
/** A stable melodic path through the changes, confined to four frets. */
export function soloTargets(tune,start=5){
 let previous=null;const plan={};
 tune.form.forEach((id,fi)=>tune.sections[id].bars.forEach((bar,bi)=>bar.forEach((chord,ci)=>{
  if(chord==='N.C.'){plan[`${fi}-${bi}-${ci}`]=null;return;}
  const parsed=parseChord(chord),pcs=chordPitchClasses(chord),guide=pcs.filter(pc=>[3,4,10,11].includes(mod12(pc-parsed.rootPc))),choices=[];
  for(let string=1;string<=6;string++)for(let fret=start;fret<start+4;fret++){
   const pitch=TUNING[6-string]+fret,pc=mod12(pitch);if(pcs.includes(pc))choices.push({string,fret,pitch,label:noteName(pc),guide:guide.includes(pc)});
  }
  choices.sort((a,b)=>((a.guide?0:5)+(previous?Math.abs(a.pitch-previous.pitch)+Math.abs(a.string-previous.string)*.3:Math.abs(a.pitch-69)*.3))-((b.guide?0:5)+(previous?Math.abs(b.pitch-previous.pitch)+Math.abs(b.string-previous.string)*.3:Math.abs(b.pitch-69)*.3)));
  const target=choices[0]??null;plan[`${fi}-${bi}-${ci}`]=target;if(target)previous=target;
 })));
 return plan;
}
/** A small phrase vocabulary: chord tones to land on, scale notes to pass through. */
export function nearbyNotes(chord,target,start,scale=[]){
 if(!target||chord==='N.C.')return [];
 const pcs=chordPitchClasses(chord),candidates=[];
 for(let string=1;string<=6;string++)for(let fret=start;fret<start+4;fret++){
  const pitch=TUNING[6-string]+fret,pc=mod12(pitch);
  if(string===target.string&&fret===target.fret||!pcs.includes(pc)&&!scale.includes(pc))continue;
  candidates.push({string,fret,pitch,label:noteName(pc),emphasis:pcs.includes(pc)?'chord':false});
 }
 candidates.sort((a,b)=>(Math.abs(a.pitch-target.pitch)+Math.abs(a.string-target.string)*.5)-(Math.abs(b.pitch-target.pitch)+Math.abs(b.string-target.string)*.5));
 const dots=[{...target,emphasis:'root'}];
 for(let string=1;string<=6;string++){
  const onString=candidates.filter(n=>n.string===string);
  if(string!==target.string){const chordTone=onString.find(n=>n.emphasis);if(chordTone)dots.push(chordTone);}
  const passing=onString.find(n=>!n.emphasis);if(passing)dots.push(passing);
  for(const note of onString){if(dots.filter(n=>n.string===string).length>=2)break;if(!dots.includes(note))dots.push(note);}
 }
 return dots;
}
