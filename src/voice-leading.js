import {getVoicings,TUNING,parseChord,noteName,chordPitchClasses,mod12} from './theory.js';
const centers={low:3,middle:7,high:12};
export const fretCenter=shape=>{const frets=shape.frets.filter(f=>f!==null);return frets.reduce((sum,f)=>sum+f,0)/frets.length;};
export function chooseShape(chord,previous,{zone='nearby',chorus=0,inversion='auto'}={}){
 if(chord==='N.C.')return null;
 let voicedChord=chord;
 const parsed=parseChord(chord);
 if(inversion!=='auto'&&!parsed.bass){const tones=chordPitchClasses(chord).map(pc=>mod12(pc-parsed.rootPc)),intervals=[0,[3,4,2,5].find(n=>tones.includes(n)),[7,6,8].find(n=>tones.includes(n)),[10,11,9].find(n=>tones.includes(n))],interval=intervals[Number(inversion)];if(interval!==undefined)voicedChord=chord+'/'+noteName(parsed.rootPc+interval);}
 const target=zone==='explore'?[3,7,12][chorus%3]:(centers[zone]??(previous?fretCenter(previous):5));
 const candidates=getVoicings(voicedChord).flatMap(shape=>[-12,0,12].flatMap(shift=>{
  const frets=shape.frets.map(f=>f===null?null:f+shift);if(frets.some(f=>f!==null&&(f<1||f>19)))return [];
  return [{...shape,frets,pitches:frets.flatMap((f,i)=>f===null?[]:[TUNING[i]+f]),name:`Frets ${Math.min(...frets.filter(f=>f!==null))}–${Math.max(...frets.filter(f=>f!==null))}`}];
 }));
 const score=shape=>{
  const center=fretCenter(shape),outside=Math.max(0,Math.abs(center-target)-3);
  let movement=0;
  if(previous){movement=Math.abs(center-fretCenter(previous))*1.5;const a=previous.pitches.slice().sort((a,b)=>a-b),b=shape.pitches.slice().sort((a,b)=>a-b);movement+=b.reduce((sum,p,i)=>sum+Math.abs(p-a[Math.min(i,a.length-1)]),0)/b.length*.3;}
  return movement+Math.abs(center-target)*(zone==='nearby'?.4:1.4)+outside*5;
 };
 return candidates.sort((a,b)=>score(a)-score(b))[0]??getVoicings(chord)[0];
}
/** One deterministic pass gives chart previews and playback the same fingerings. */
export function planShapes(tune,options={}){
 const plan={};let previous=null;
 tune.form.forEach((id,fi)=>tune.sections[id].bars.forEach((bar,bi)=>bar.forEach((chord,ci)=>{
  const shape=chooseShape(chord,previous,options);plan[`${fi}-${bi}-${ci}`]={chord,shape};if(shape)previous=shape;
 })));
 return plan;
}
