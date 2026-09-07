export function clampTempo(value) {return Math.min(240,Math.max(40,Number(value)||120));}
const EPS=1e-7;
export function barTiming(tune,section,index){
 const chords=tune.sections[section].bars[index],beats=Number(tune.timeSignature.split('/')[0]);
 const durations=tune.sections[section].barDurations?.[index]||chords.map(()=>beats/chords.length);
 return {chords,durations};
}
function position(tune,section,index,beat){
 const {chords,durations}=barTiming(tune,section,index);let start=0;
 for(let i=0;i<chords.length;i++){const end=start+durations[i];if(beat<end-EPS||i===chords.length-1)return {chord:chords[i],index:i,start,end,chords};start=end;}
}
/** Advance at both quarter-beat pulses and exact chord boundaries. */
export class Timeline {
 constructor(tune,{tempo=tune.tempo,loopSection=null,countIn=false,startTime=0}={}){
  this.tune=tune;this.tempo=clampTempo(tempo);this.pendingTempo=this.tempo;this.loopSection=loopSection;
  this.beatsPerBar=Number(tune.timeSignature.split('/')[0]);this.formIndex=loopSection?Math.max(0,tune.form.indexOf(loopSection)):0;
  this.barIndex=0;this.beat=0;this.countIn=countIn;this.time=startTime;
 }
 next(){
  if(this.beat===0)this.tempo=this.pendingTempo;
  const section=this.tune.form[this.formIndex],p=position(this.tune,section,this.barIndex,this.beat);
  const melodyBoundary=this.countIn?Infinity:(this.tune.sections[section].melody?.[this.barIndex]?.find(n=>n.beat>this.beat+EPS)?.beat??Infinity);
  const nextBeat=Math.min(this.beatsPerBar,Math.floor(this.beat+EPS)+1,this.countIn?Infinity:p.end,melodyBoundary);
  const step=nextBeat-this.beat;
  const event={time:this.time,duration:60/this.tempo*4/Number(this.tune.timeSignature.split('/')[1]),stepDuration:step*60/this.tempo*4/Number(this.tune.timeSignature.split('/')[1]),section,formIndex:this.formIndex,barIndex:this.barIndex,beat:this.beat,chord:p.chord,chordIndex:p.index,countIn:this.countIn,chordBoundary:Math.abs(this.beat-p.start)<EPS,chordRemaining:p.end-this.beat};
  const bars=this.tune.sections[section].bars;
  event.followingChord=p.chords[p.index+1]??(bars[this.barIndex+1]?.[0]??this.tune.sections[this.loopSection||this.tune.form[(this.formIndex+1)%this.tune.form.length]].bars[0][0]);
  this.time+=event.stepDuration;this.beat=nextBeat;
  if(this.beat>=this.beatsPerBar-EPS){
   this.beat=0;
   if(this.countIn)this.countIn=false;
   else if(this.loopSection&&section!==this.loopSection){this.formIndex=Math.max(0,this.tune.form.indexOf(this.loopSection));this.barIndex=0;}
   else {this.barIndex++;if(this.barIndex>=bars.length){this.barIndex=0;if(!this.loopSection)this.formIndex=(this.formIndex+1)%this.tune.form.length;}}
  }
  event.nextChord=position(this.tune,this.tune.form[this.formIndex],this.barIndex,this.beat).chord;
  return event;
 }
}
