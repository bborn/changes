import {TUNING} from './theory.js';
/** A single melody note, placed near the previous note on the neck. */
export function melodyShape(chord,midi,previous=5){
 if(midi===null)return null;
 const choices=TUNING.flatMap((pitch,string)=>{const fret=midi-pitch;if(fret<0||fret>19)return [];const frets=Array(6).fill(null);frets[string]=fret;return [{frets,pitches:[midi],top:string,fret}];});
 return choices.sort((a,b)=>(Math.abs(a.fret-(previous??5))+(5-a.top)*.3)-(Math.abs(b.fret-(previous??5))+(5-b.top)*.3))[0]??null;
}
export function melodyTab(events,chords){
 // Choose a hand position for the whole phrase before assigning strings.
 const pitches=events.filter(e=>e.midi!==null).map(e=>e.midi);
 const cost=anchor=>pitches.reduce((sum,midi)=>sum+Math.min(...TUNING.map(p=>midi-p).filter(f=>f>=0&&f<=19).map(f=>Math.max(anchor-f,0,f-anchor-3)**2)),0)+Math.abs(anchor-5)*.12;
 const anchor=Array.from({length:16},(_,i)=>i).sort((a,b)=>cost(a)-cost(b))[0];
 return events.map(event=>{const chord=chords[Math.min(chords.length-1,Math.floor(event.beat/4*chords.length))],shape=melodyShape(chord,event.midi,anchor+1.5);return {...event,chord,shape};});
}
export function renderTab(events,{previewPrefix=null}={}){
 const beats=Math.max(...events.map(e=>e.beat+e.duration)),width=360,left=30,unit=(width-left-18)/beats;
 const xFor=e=>left+e.beat*unit+10;
 let svg=`<svg class="melody-tab" viewBox="0 0 ${width} 156" role="group" aria-label="Guitar tablature with rhythm">`;
 for(let s=0;s<6;s++){const y=24+s*18;svg+=`<text x="3" y="${y+4}" font-size="10" fill="#788172">${['e','B','G','D','A','E'][s]}</text><line x1="22" x2="${width}" y1="${y}" y2="${y}" stroke="#b6baac"/>`;}
 for(let b=0;b<beats;b++)svg+=`<text x="${left+b*unit+10}" y="10" text-anchor="middle" font-size="9" fill="#788172">${b+1}</text>`;
 events.forEach((event,i)=>{
  const x=xFor(event),end=x+event.duration*unit-7,interactive=previewPrefix!==null&&event.shape;
  svg+=`<g data-melody-beat="${event.beat}" data-melody-end="${event.beat+event.duration}"${interactive?` data-melody-preview="${previewPrefix}-${i}" role="button" tabindex="0" aria-label="Play note, fret ${event.shape.fret}"`:''}><rect class="note-highlight" x="${x-13}" y="15" width="${Math.max(24,event.duration*unit-4)}" height="133" rx="5" fill="transparent"/>`;
  if(!event.shape){svg+=`<text x="${x}" y="77" text-anchor="middle" font-size="20" fill="#788172">𝄽</text></g>`;return;}
  const y=24+(5-event.shape.top)*18;
  if(event.duration>1)svg+=`<line x1="${x+10}" x2="${Math.min(end,width-5)}" y1="${y}" y2="${y}" stroke="#b84928" stroke-width="3" opacity=".3"/>`;
  svg+=`<rect x="${x-10}" y="${y-9}" width="20" height="18" rx="3" fill="#faf9f3"/><text x="${x}" y="${y+5}" text-anchor="middle" font-size="15" font-weight="600" fill="#b84928">${event.shape.fret}</text>`;
  if(event.tie)svg+=`<path d="M ${x-20} ${y+10} Q ${x-9} ${y+20} ${x} ${y+10}" fill="none" stroke="#b84928" stroke-width="1.5"/>`;
  if(event.duration<4){svg+=`<line x1="${x}" x2="${x}" y1="120" y2="142" stroke="#526451" stroke-width="1.5"/>`;if(event.duration>=2)svg+=`<ellipse cx="${x-3}" cy="121" rx="4" ry="2.5" fill="#faf9f3" stroke="#526451"/>`;}
  if([.75,1.5,3].some(d=>Math.abs(d-event.duration)<.01))svg+=`<circle cx="${x+6}" cy="123" r="1.6" fill="#526451"/>`;
  if(event.duration<1){const next=events[i+1],joined=next?.shape&&next.duration<1&&Math.floor(next.beat)===Math.floor(event.beat);const to=joined?xFor(next):x+8;svg+=`<path d="M ${x} 141 H ${to}" stroke="#526451" stroke-width="3"/>`;if(event.duration<.5)svg+=`<path d="M ${x} 135 H ${to}" stroke="#526451" stroke-width="2.5"/>`;}
  svg+='</g>';
 });return svg+'</svg>';
}
