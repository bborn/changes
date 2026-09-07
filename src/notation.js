import {notationEvents} from './notation-model.js';
let loading;
function loadRenderer(){return loading ||= new Promise((resolve,reject)=>{if(globalThis.Vex?.Flow){resolve(globalThis.Vex.Flow);return;}const script=document.createElement('script');script.src='/src/vendor/vexflow.js';script.onload=()=>resolve(globalThis.Vex.Flow);script.onerror=()=>{loading=null;script.remove();reject(Error('Could not load notation.'));};document.head.append(script);});}
export async function mountNotation(root,tune,{mode,hints,onPreview,onReady}){
 if(mode==='tab')return;
 let VF;try{VF=await loadRenderer();}catch(error){root.querySelectorAll('[data-score]').forEach(el=>el.textContent=error.message);return;}
 for(const host of root.querySelectorAll('[data-score]')){
  if(!host.isConnected)return;
  if(host.dataset.rendered)continue;host.dataset.rendered='true';
  const [fi,bi]=host.dataset.score.split('-').map(Number),section=tune.sections[tune.form[fi]],events=JSON.parse(host.dataset.events);
  try{drawBar(VF,host,events,{key:tune.key,meter:tune.timeSignature,mode,hints,onPreview,section,fi,bi});}
  catch(error){host.textContent='This bar cannot be shown in Notes yet. Switch to Tab.';host.classList.add('notation-error');console.warn('Notation bar',fi,bi,error);}
 }
 onReady?.();
}
function drawBar(VF,host,events,{key,meter,mode,hints,onPreview,fi,bi}){
 const {Renderer,Stave,StaveNote,Voice,Formatter,Accidental,Dot,Beam,Tuplet,StaveTie}=VF;
 key=({Dbm:'C#m',Gbm:'F#m',Abm:'G#m'})[key]||key;
 const parts=notationEvents(events,key,meter),both=mode==='both';
 const width=Math.max(330,host.clientWidth,125+parts.length*31),height=both?280:hints?190:166;
 const renderer=new Renderer(host,Renderer.Backends.SVG);renderer.resize(width,height);const ctx=renderer.getContext();ctx.setFillStyle('#263d33');ctx.setStrokeStyle('#263d33');
 const stave=new Stave(4,20,width-8).addClef('treble').addKeySignature(key).addTimeSignature(meter);stave.setContext(ctx).draw();
 const notes=parts.map(p=>{const n=new StaveNote({clef:'treble',keys:[p.pitch?.key||'b/4'],duration:p.duration+(p.pitch?'':'r'),dots:p.dots,auto_stem:true});for(let i=0;i<p.dots;i++)Dot.buildAndAttach([n],{all:true});return n;});
 const tuplets=[];for(let i=0;i<parts.length;i++){if(parts[i].ratio===1)continue;const ratio=parts[i].ratio,group=[notes[i]];while(i+1<parts.length&&parts[i+1].ratio===ratio&&group.length<(ratio===1.5?3:ratio===1.25?5:7)){group.push(notes[++i]);}const num=ratio===1.5?3:ratio===1.25?5:7,occupied=ratio===1.5?2:4;tuplets.push(new Tuplet(group,{num_notes:num,notes_occupied:occupied,bracketed:true,ratioed:group.length!==num}));}
 const [numBeats,beatValue]=meter.split('/').map(Number),voice=new Voice({num_beats:numBeats,beat_value:beatValue}).setMode(Voice.Mode.SOFT).addTickables(notes);
 Accidental.applyAccidentals([voice],key);
 const beams=Beam.generateBeams(notes,{groups:[new VF.Fraction(beatValue===8&&numBeats%3===0?3:1,beatValue)]});
 new Formatter().joinVoices([voice]).format([voice],width-stave.getNoteStartX()-20);
 voice.draw(ctx,stave);beams.forEach(b=>b.setContext(ctx).draw());tuplets.forEach(t=>t.setContext(ctx).draw());
 parts.forEach((p,i)=>{if(!p.pitch||!p.continued)return;const previous=i?notes[i-1]:undefined;if(i&&parts[i-1].midi!==p.midi)return;new StaveTie({first_note:previous,last_note:notes[i],first_indices:[0],last_indices:[0]}).setContext(ctx).draw();});
 const svg=host.querySelector('svg'),NS='http://www.w3.org/2000/svg';svg.setAttribute('role','group');svg.setAttribute('aria-label',both?'Melody notation aligned with guitar tab':'Melody in standard notation');
 const add=(tag,attributes,text)=>{const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries({stroke:'none',...attributes}))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;svg.append(el);return el;};
 if(both)for(let s=0;s<6;s++){const y=178+s*15;add('text',{x:8,y:y+4,'font-size':10,fill:'#788172'},['e','B','G','D','A','E'][s]);add('line',{x1:26,x2:width-8,y1:y,y2:y,stroke:'#b6baac'});}
 parts.forEach((p,i)=>{
  const x=notes[i].getAbsoluteX()+5,next=notes[i+1]?.getAbsoluteX()??width-8,shape=events[p.index].shape;
  const group=add('g',{'data-melody-beat':p.beat,'data-melody-end':p.beat+p.durationBeats,class:'reading-note'});
  const hit=add('rect',{x:x-13,y:25,width:Math.max(26,next-x),height:height-33,rx:5,class:'note-highlight',fill:'transparent'});group.append(hit);svg.insertBefore(group,svg.firstChild);
  const note=notes[i].getSVGElement();if(note)group.append(note);
  if(both&&shape){const y=178+(5-shape.top)*15;group.append(add('rect',{x:x-9,y:y-9,width:18,height:18,rx:3,fill:'#faf9f3'}));group.append(add('text',{x,y:y+5,'text-anchor':'middle','font-size':14,fill:'#b84928','font-weight':600},shape.fret));}
  if(hints&&p.pitch){const label=p.pitch.name.replaceAll('b','♭').replaceAll('#','♯');group.append(add('text',{x,y:both?274:178,'text-anchor':'middle','font-size':10,fill:'#66765b'},label));}
  if(p.pitch){group.setAttribute('role','button');group.setAttribute('tabindex','0');group.setAttribute('aria-label',`Hear ${p.pitch.name}${p.pitch.octave}`);const play=()=>{onPreview([p.midi]);if(hints&&shape){const hint=host.closest('.melody-chart')?.previousElementSibling?.querySelector('[data-reading-help]');if(hint)hint.textContent=`${p.pitch.name}${p.pitch.octave} · ${['E','A','D','G','B','high E'][shape.top]} string · fret ${shape.fret}`;}};group.onclick=play;group.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();play();}};}
 });
}
