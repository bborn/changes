import {barTiming} from './audio/timeline.js';
import {chordPitchClasses,mod12,noteName,parseChord,scalePitchClasses,TUNING} from './theory.js';
import {scaleForChord} from '../data/scales.js';

const positions=start=>Array.from({length:6},(_,i)=>i+1).flatMap(string=>
 Array.from({length:4},(_,fret)=>{const pitch=TUNING[6-string]+start+fret;return {string,fret:start+fret,pitch,pc:mod12(pitch),label:noteName(pitch)};}));
const LETTERS='CDEFGAB',NATURAL={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
function targetLabel(note,chord){
 const interval=mod12(note.pc-chord.rootPc),steps=[3,4].includes(interval)?2:[10,11].includes(interval)?6:null;
 if(steps===null)return note.label;
 const letter=LETTERS[mod12(LETTERS.indexOf(chord.root[0])+steps)%7];let accidental=mod12(note.pc-NATURAL[letter]);if(accidental>6)accidental-=12;
 return letter+(accidental>0?'#'.repeat(accidental):'b'.repeat(-accidental));
}

function chordEvents(tune,section,formIndex,bars){
 const beats=Number(tune.timeSignature.split('/')[0])||4;let phraseBeat=0;
 return bars.flatMap(({barIndex})=>{
  const {chords,durations}=barTiming(tune,section,barIndex);let beat=0;
  const result=chords.map((chord,chordIndex)=>{const duration=Number(durations[chordIndex]);const event={key:`${formIndex}-${barIndex}-${chordIndex}`,chord,beat:phraseBeat+beat,duration,barIndex,formIndex};beat+=duration;return event;});
  phraseBeat+=beats;return result;
 });
}

function chooseTargets(events,board,previous=null){
 const loads=new Map(),result=[];
 for(const event of events){
  if(event.chord==='N.C.'){event.target=null;continue;}
  const chord=parseChord(event.chord),pcs=chordPitchClasses(event.chord);
  const guides=pcs.filter(pc=>[3,4,10,11].includes(mod12(pc-chord.rootPc)));
  const candidates=board.filter(n=>pcs.includes(n.pc)).sort((a,b)=>{
   const interval=n=>mod12(n.pc-chord.rootPc),guideCost=n=>[3,4].includes(interval(n))?0:[10,11].includes(interval(n))?0.5:guides.includes(n.pc)?1:4;
   const score=n=>guideCost(n)+(previous?Math.abs(n.pitch-previous.pitch)+Math.abs(n.string-previous.string)*.4:Math.abs(n.pitch-69)*.25)+(loads.get(`${n.string}-${n.fret}`)||0)*2;
   return score(a)-score(b)||a.string-b.string||a.fret-b.fret;
  });
  const target=candidates[0]||null,label=target&&targetLabel(target,chord);event.target=target?{string:target.string,fret:target.fret,pitch:target.pitch,label}:null;
  if(target){previous=target;const key=`${target.string}-${target.fret}`;loads.set(key,(loads.get(key)||0)+1);result.push({...target,label,eventKey:event.key,number:result.length+1});}
 }
 return {targets:result,last:previous};
}

function allowedPassing(events){
 const sounding=events.filter(e=>e.chord!=='N.C.');if(!sounding.length)return new Set();
 const sets=sounding.map((event,index)=>{
  const next=sounding[index+1]?.chord;const suggestion=scaleForChord(event.chord,next);
  return new Set(scalePitchClasses(suggestion.primary));
 });
 return new Set([...sets[0]].filter(pc=>sets.every(set=>set.has(pc))));
}

function phraseDots(events,board,targets){
 const sounding=events.filter(e=>e.chord!=='N.C.');if(!sounding.length)return [];
 const chordSets=sounding.map(e=>new Set(chordPitchClasses(e.chord)));
 const common=new Set([...chordSets[0]].filter(pc=>chordSets.every(set=>set.has(pc))));
 const passing=allowedPassing(events),byPosition=new Map();
 for(const target of targets){const key=`${target.string}-${target.fret}`,dot=byPosition.get(key);if(dot){dot.numbers.push(target.number);dot.eventKeys.push(target.eventKey);}else byPosition.set(key,{string:target.string,fret:target.fret,pitch:target.pitch,label:target.label,role:'target',number:target.number,numbers:[target.number],eventKeys:[target.eventKey]});}
 const addRole=(role,set)=>{
  for(let string=1;string<=6;string++){
   const occupied=()=>[...byPosition.values()].filter(n=>n.string===string).length;
   for(const note of board.filter(n=>n.string===string&&set.has(n.pc))){
    if(occupied()>=2)break;const key=`${note.string}-${note.fret}`;if(!byPosition.has(key))byPosition.set(key,{string:note.string,fret:note.fret,pitch:note.pitch,label:note.label,role});
   }
  }
 };
 addRole('common',common);addRole('passing',new Set([...passing].filter(pc=>!common.has(pc))));
 return [...byPosition.values()].sort((a,b)=>a.string-b.string||a.fret-b.fret);
}

function practiceRiff(events,beats,board,{style,beatsPerBar,variant=0,level='intermediate'}={}){
 const sounding=events.filter(e=>e.target);if(!sounding.length)return [];
 // An eight-bar sentence: state, echo, develop, then answer and breathe.
 // Plan the silence first; chord changes must not fill it back in.
 const role=variant%4,family=Math.floor(variant/4)%3;
 const patterns=level==='beginner'?[
  [[0,1],[0,2]],[[1,2],[1]],[[0,2],[0,1]],
 ]:level==='advanced'?[
  [[0,1/3,2/3,1,1.5,2],[0,1/3,2/3,1,1.5,2]],
  [[.5,1,1.5,2,2+1/3,2+2/3],[.5,1,1.5,2]],
  [[0,.5,1,1+1/3,1+2/3],[0,.5,1,1+1/3,1+2/3,2]],
 ]:[
  [[0,.5,1],[0,.5,1,2]],
  [[.5,1,2],[.5,1,2]],
  [[0,1,1.5],[0,1,1.5,2]],
 ];
 const rhythm=patterns[family];
 const swing=style==='swing',starts=[];
 for(let bar=0;bar<Math.ceil(beats/beatsPerBar);bar++){
  let motif=[...rhythm[bar%2]];
  const connects=beats>beatsPerBar&&role!==3;
  if(connects&&bar<Math.ceil(beats/beatsPerBar)-1)motif[motif.length-1]=beatsPerBar-(level==='beginner'?1:.5);
  if(connects&&bar>0)motif=motif.filter(beat=>beat>0);
  // The last answer is shorter. A developed statement has a delayed entry.
  if(role===3&&bar%2===1)motif=motif.slice(0,level==='beginner'?1:2);
  for(const [motifIndex,beat] of motif.entries()){
   const shifted=beat+(role===2&&bar===0&&beat<beatsPerBar-1?(level==='beginner'?1:.5):0);
   const offset=swing&&shifted%1===.5?Math.floor(shifted)+2/3:shifted;
   if(offset<(bar<Math.ceil(beats/beatsPerBar)-1&&connects?beatsPerBar:beatsPerBar-1))starts.push({beat:bar*beatsPerBar+offset,motifIndex,bar});
  }
 }
 const slots=starts.sort((a,b)=>a.beat-b.beat).filter(slot=>slot.beat<beats).flatMap(({beat,motifIndex,bar})=>{
  const event=events.find(e=>beat>=e.beat-1e-7&&beat<e.beat+e.duration-1e-7);
  if(!event?.target)return [];
  const boundary=Math.abs(beat-event.beat)<1e-7,strong=boundary||Math.abs(beat-Math.round(beat))<1e-7;
  const pcs=chordPitchClasses(event.chord),scale=scalePitchClasses(scaleForChord(event.chord).primary);
  let candidates=board.filter(n=>n.string<=4&&(strong||level==='beginner'?pcs:scale).includes(n.pc));
  const nextBar=(bar+1)*beatsPerBar,nextEvent=events.find(e=>e.beat<=nextBar&&e.beat+e.duration>nextBar);
  if(beat>=nextBar-1&&nextBar<beats&&nextEvent?.target){
   const shared=candidates.filter(n=>pcs.includes(n.pc)&&chordPitchClasses(nextEvent.chord).includes(n.pc));
   if(shared.length)candidates=shared;
  }
  return [{beat,event,boundary,motifIndex,bar,candidates:candidates.filter(Boolean)}];
 });
 // Resolve the answer on its current chord's guide tone.
 if(slots.length){const last=slots.at(-1);last.candidates=board.filter(n=>n.pitch===last.event.target.pitch&&n.string===last.event.target.string);}
 // Search complete melodic gestures, keeping history so A-B-A-B is costly.
 // Each gesture travels through a register before returning to its resolution.
 const register=board.filter(n=>n.string<=4),low=Math.min(...register.map(n=>n.pitch)),high=Math.max(...register.map(n=>n.pitch));
 const anchor=slots[0]?.event.target.pitch??60,ending=slots.at(-1)?.event.target.pitch??anchor;
 const direction=high-anchor>=anchor-low?1:-1,span=level==='advanced'?9:level==='beginner'?5:7;
 const shapes=[[0,.45,.8,1,.8,.5,.2,0],[0,.7,1,.85,.6,.4,.15,0],[0,.35,.7,.5,1,.7,.3,0]];
 const shape=shapes[(family+role)%shapes.length];
 let paths=[{cost:0,notes:[]}];
 for(let i=0;i<slots.length;i++){
  const slot=slots[i],progress=slots.length===1?1:i/(slots.length-1),position=progress*(shape.length-1),index=Math.floor(position);
  const arc=shape[index]+((shape[index+1]??shape[index])-shape[index])*(position-index);
  const desired=Math.max(low,Math.min(high,anchor+(ending-anchor)*progress+direction*span*arc));
  const expanded=[];
  for(const path of paths)for(const note of slot.candidates){
    const previous=path.notes.at(-1),distance=previous?Math.abs(note.pitch-previous.pitch):0;
    const repeated=path.notes.filter(n=>n.pitch===note.pitch).length;
    const bounce=path.notes.length>=2&&path.notes.at(-2).pitch===note.pitch;
    const oscillation=bounce&&path.notes.length>=3&&path.notes.at(-3).pitch===previous.pitch;
    const cost=path.cost+Math.abs(note.pitch-desired)*1.2+(previous?distance*.12+Math.max(0,distance-7)*4+Math.abs(note.string-previous.string)*.25+(distance===0?7:0):0)+(bounce?7:0)+(oscillation?12:0)+Math.max(0,repeated-1)*2;
    expanded.push({cost,notes:[...path.notes,note]});
  }
  paths=expanded.sort((a,b)=>a.cost-b.cost).slice(0,48);
 }
 const line=paths.sort((a,b)=>a.cost-b.cost)[0]?.notes||[];
 return line.map((note,i)=>{
  const slot=slots[i];
  let end=slots[i+1]?.beat??beats;
  for(const change of events.filter(e=>e.beat>slot.beat&&e.beat<end)){
   if(!change.target||!chordPitchClasses(change.chord).includes(note.pc)){end=change.beat;break;}
  }
  const crosses=slot.beat<(slot.bar+1)*beatsPerBar&&end>(slot.bar+1)*beatsPerBar;
  const gap=end-slot.beat,offbeat=Math.abs(slot.beat-Math.round(slot.beat))>1e-7;
  // Connect the long eighth into an accented, shorter pickup; taper the sentence.
  const gate=crosses?.96:offbeat?.78:.94;
  const duration=Math.min(gap*gate, crosses?1.2:i===line.length-1?.9:level==='beginner'?.9:.7, beats-.9-slot.beat);
  const emphasis=i===line.length-1?.72:slot.motifIndex===0?.9:offbeat?1.08:.82;
  // Stable performance variation: relaxed interior attacks, anchored phrase entries.
  // Seconds, not accumulated beat shifts; the next phrase never drifts off the band.
  const variation=((i*17+note.pitch*7+variant*11)%13)/12;
  const timingOffset=slot.boundary||i===0?0:(style==='swing'?.008:.003)+variation*.012;
  const velocity=emphasis*(.95+variation*.1);
  return {beat:slot.beat,duration,velocity,timingOffset,string:note.string,fret:note.fret,pitch:note.pitch,label:targetLabel(note,parseChord(slot.event.chord)),eventKey:slot.event.key,role:note.pitch===slot.event.target.pitch?'target':chordPitchClasses(slot.event.chord).includes(note.pc)?'chord':'passing'};
 }).filter(note=>note.duration>0);
}

/** Build stable two-bar practice phrases. Pairs never cross a form-section boundary. */
export function buildSoloPhrases(tune,startFret=5,{loop=null,level='intermediate'}={}){
 const board=positions(startFret),beatsPerBar=Number(tune.timeSignature.split('/')[0])||4,phrases=[];
 let absoluteBar=0,previousTarget=null;
 tune.form.forEach((section,formIndex)=>{
  const sectionBars=tune.sections[section].bars;
  if(loop&&(section!==loop||formIndex!==tune.form.indexOf(loop))){absoluteBar+=sectionBars.length;return;}
  for(let first=0;first<sectionBars.length;first+=2){
   const indices=[first,first+1].filter(i=>i<sectionBars.length);
   const bars=indices.map(barIndex=>({formIndex,barIndex,number:absoluteBar+barIndex+1,chords:[...sectionBars[barIndex]]}));
   const events=chordEvents(tune,section,formIndex,bars),chosen=chooseTargets(events,board,previousTarget),targets=chosen.targets,beats=bars.length*beatsPerBar;previousTarget=chosen.last;
   for(const bar of bars)bar.events=events.filter(e=>e.barIndex===bar.barIndex);
   const phrase={id:`${formIndex}-${first}`,section,formIndex,bars,events,beats,dots:phraseDots(events,board,targets)};
   phrases.push(phrase);
  }
  absoluteBar+=sectionBars.length;
 });
 // Compose across display cards, then project that one line into each card.
 for(let first=0;first<phrases.length;first+=2){
  const group=phrases.slice(first,first+2);let total=0;
  const offsets=group.map(p=>{const offset=total;total+=p.beats;return offset;});
  const events=group.flatMap((p,i)=>p.events.map(e=>({...e,beat:e.beat+offsets[i]})));
  const line=practiceRiff(events,total,board,{style:tune.style,beatsPerBar,level,variant:Math.floor(first/2)});
  group.forEach((p,i)=>{
   const offset=offsets[i];p.sentence=first/2;p.sentenceEnd=i===group.length-1;
   p.riff=line.filter(n=>n.beat<offset+p.beats&&n.beat+n.duration>offset).map(n=>{
    const tie=n.beat<offset;
    return {...n,beat:Math.max(0,n.beat-offset),duration:tie?n.beat+n.duration-offset:n.duration,tie,
     eventKey:tie?p.events[0].key:n.eventKey};
   });
  });
 }
 return phrases;
}

export function phraseForLocation(phrases,formIndex,barIndex){
 return phrases.find(phrase=>phrase.formIndex===formIndex&&phrase.bars.some(bar=>bar.barIndex===barIndex))||null;
}
