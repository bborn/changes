/** Duration of a note plus contiguous tied notes, following the active form. */
export function melodyDuration(tune,event,loopSection=null){
 let fi=event.formIndex,bi=event.barIndex;
 let bar=tune.sections[tune.form[fi]].melody?.[bi]||[];
 let ni=bar.findIndex(n=>Math.abs(n.beat-event.beat)<1e-6);
 if(ni<0)return null;
 const note=bar[ni];let duration=note.duration,end=note.beat+note.duration;
 const beats=Number(tune.timeSignature.split('/')[0]);
 // Bound traversal even for a malformed circular tie.
 for(let guard=0;guard<512;guard++){
  ni++;
  if(ni>=bar.length){
   if(Math.abs(end-beats)>1e-6)break;
   bi++;
   if(bi>=tune.sections[tune.form[fi]].bars.length){bi=0;fi=loopSection?tune.form.indexOf(loopSection):(fi+1)%tune.form.length;}
   bar=tune.sections[tune.form[fi]].melody?.[bi]||[];ni=0;end=0;
  }
  const next=bar[ni];
  if(!next?.tie||note.midi===null||next.midi!==note.midi||Math.abs(next.beat-end)>1e-6)break;
  duration+=next.duration;end=next.beat+next.duration;
 }
 return {...note,duration};
}
