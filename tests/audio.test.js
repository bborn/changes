import test from 'node:test';
import assert from 'node:assert/strict';
import { Timeline } from '../src/audio/timeline.js';
const tune = { tempo: 120, timeSignature: '4/4', form: ['A', 'A', 'B'], sections: { A: { bars: [['Cm7', 'F7']] }, B: { bars: [['Bbmaj7']] } } };
test('audio clock is continuous across repeated form and loop boundaries', () => {
  const clock = new Timeline(tune, { startTime: 2 });
  const events = Array.from({ length: 16 }, () => clock.next());
  assert.deepEqual(events.filter(e => e.beat === 0).map(e => e.formIndex), [0, 1, 2, 0]);
  assert.deepEqual(events.map(e => e.time), Array.from({ length: 16 }, (_, i) => 2 + i / 2));
  assert.deepEqual(events.slice(0, 4).map(e => e.chord), ['Cm7', 'Cm7', 'F7', 'F7']);
});
test('count in lasts one bar and section loop stays in selected section', () => {
  const clock = new Timeline(tune, { loopSection: 'B', countIn: true });
  const events = Array.from({ length: 16 }, () => clock.next());
  assert.equal(events.filter(e => e.countIn).length, 4);
  assert.ok(events.every(e => e.section === 'B'));
  assert.equal(events[4].time, 2);
});
test('tempo is applied only on next bar with no discontinuity', () => {
  const clock = new Timeline(tune);
  clock.next();
  clock.pendingTempo = 60;
  const events = Array.from({ length: 5 }, () => clock.next());
  assert.deepEqual(events.map(e => e.time), [0.5, 1, 1.5, 2, 3]);
  assert.deepEqual(events.map(e => e.duration), [0.5, 0.5, 0.5, 1, 1]);
});
test('changing section takes effect at bar boundary', () => {
  const clock = new Timeline(tune);
  clock.next();
  clock.loopSection = 'B';
  const events = Array.from({ length: 4 }, () => clock.next());
  assert.deepEqual(events.map(e => e.section), ['A', 'A', 'A', 'B']);
});

import { AudioEngine } from '../src/audio/engine.js';
import { getVoicings, chordPitchClasses } from '../src/theory.js';
function instrumentSpy(style, bars) {
  const tune = { tempo: 120, style, timeSignature: '4/4', form: ['A'], sections: { A: { bars } } };
  const engine = new AudioEngine();
  engine.timeline = new Timeline(tune);
  const bass = [], chords = [];
  engine.tone = (pitch, time, duration) => bass.push({ pitch, time, duration });
  engine.chord = (pitches, time, duration) => chords.push({ pitches, time, duration });
  engine.drum = () => {};
  return { engine, bass, chords };
}
test('swing bass uses diminished chord fifths and sus fourths', () => {
  for (const symbol of ['Cm7b5', 'Cdim7', 'Csus4']) {
    const { engine, bass } = instrumentSpy('swing', [[symbol]]);
    for (let i = 0; i < 4; i++) engine.schedule(engine.timeline.next());
    const tones = chordPitchClasses(symbol);
    assert.equal(bass[1].pitch % 12, tones[1]);
    assert.equal(bass[2].pitch % 12, tones[2]);
  }
});
test('each style sounds every one-beat chord using actual voicing pitches', () => {
  const changes = ['Cm7', 'F7', 'Bbmaj7', 'Ebmaj7'];
  for (const style of ['swing', 'bossa', 'funk', 'ballad']) {
    const { engine, chords, bass } = instrumentSpy(style, [changes]);
    for (let i = 0; i < 4; i++) engine.schedule(engine.timeline.next());
    assert.deepEqual(chords.map(note => note.pitches), changes.map(c => getVoicings(c)[0].pitches), style);
    assert.deepEqual(chords.map(note => note.time), [0, 0.5, 1, 1.5], style);
    assert.ok(chords.every(note => note.duration <= 0.5), style);
    assert.ok(bass.every(note => note.time + note.duration <= Math.floor(note.time / 0.5) * 0.5 + 0.5 + 1e-9), style);
  }
});
test('melody has an independent mixer route while previews bypass its mute', async() => {
  const engine = new AudioEngine(), values=[];
  assert.deepEqual({volume:engine.tracks.melody.volume,muted:engine.tracks.melody.muted},{volume:.7,muted:false});
  engine.context={currentTime:0};engine.tracks.melody.gain={gain:{setTargetAtTime:(...args)=>values.push(args)}};
  engine.setTrack('melody',{volume:.35,muted:true});
  assert.deepEqual(values,[ [0,0,.015] ]);assert.equal(engine.tracks.melody.volume,.35);assert.equal(engine.tracks.chords.muted,false);

  const melodyTune={tempo:120,style:'swing',timeSignature:'4/4',form:['A'],sections:{A:{bars:[['C']],melody:[[{midi:72,beat:0,duration:1}]]}}};
  engine.timeline=new Timeline(melodyTune);engine.context={currentTime:0,getOutputTimestamp:()=>({contextTime:0})};engine.playing=true;engine.hearMelody=true;engine.melodyFilter={name:'melody'};engine.previewFilter={name:'preview'};engine.schedule=()=>{};engine.timer=0;
  const destinations=[];engine.chord=(pitches,time,duration,destination)=>destinations.push(destination);engine.tick();clearTimeout(engine.timer);
  assert.equal(destinations[0],engine.melodyFilter);
  engine.playing=false;engine.initialize=async()=>{};engine.prepareSamples=async()=>{};await engine.preview([60]);
  assert.equal(destinations.at(-1),engine.previewFilter);
});
test('lookahead schedules ahead but emits highlights only at audible clock time', () => {
  const engine = new AudioEngine();
  engine.context = { currentTime: 0, getOutputTimestamp: () => ({ contextTime: engine.context.currentTime }) };
  engine.timeline = new Timeline(tune, { startTime: 0.08 });
  engine.playing = true;
  const scheduled = [], heard = [];
  engine.schedule = event => scheduled.push(event);
  engine.addEventListener('beat', event => heard.push(event.detail));
  engine.tick();
  clearTimeout(engine.timer);
  assert.equal(scheduled.length, 1);
  assert.equal(heard.length, 0);
  engine.context.currentTime = 0.09;
  engine.tick();
  clearTimeout(engine.timer);
  assert.equal(heard.length, 1);
  engine.stop();
  engine.context.currentTime = 1;
  engine.tick();
  assert.equal(heard.length, 1);
});
test('resuming a delayed scheduler skips expired notes instead of bursting', () => {
  const engine = new AudioEngine();
  engine.context = { currentTime: 10 };
  engine.timeline = new Timeline(tune);
  engine.playing = true;
  const scheduled = [];
  engine.schedule = event => scheduled.push(event.time);
  engine.tick();
  engine.stop();
  assert.deepEqual(scheduled, [10]);
});
test('slash bass changes root beat without transposing the chord tones', () => {
  const { engine, bass } = instrumentSpy('swing', [['C/E']]);
  for (let i = 0; i < 4; i++) engine.schedule(engine.timeline.next());
  assert.deepEqual(bass.slice(0, 3).map(note => note.pitch % 12), [4, 4, 7]);
});

test('interface feedback shares the context, throttles repeated cues, and stays silent during playback', async () => {
  const engine = new AudioEngine();
  engine.context = { currentTime: 1 };
  engine.master = {};
  let initialized = 0;
  engine.initialize = async () => { initialized++; };
  const notes = [];
  engine.tone = (...args) => notes.push(args);
  await engine.feedback('open');
  assert.equal(initialized, 1);
  assert.deepEqual(notes.map(n => n[0]), [74, 81]);
  assert.ok(notes.every(n => n[3] === engine.master && n[4] <= 0.035));
  await engine.feedback('tap');
  assert.equal(notes.length, 2);
  engine.context.currentTime = 2;
  engine.playing = true;
  await engine.feedback('close');
  assert.equal(notes.length, 2);
  assert.equal(initialized, 2);
});

test('a pending interface cue is cancelled when transport resets', async () => {
  const engine = new AudioEngine();
  let resume;
  engine.initialize = () => new Promise(resolve => { resume = resolve; });
  engine.context = { currentTime: 1 };
  const notes = [];
  engine.tone = (...args) => notes.push(args);
  const pending = engine.feedback('open');
  engine.stop();
  resume();
  await pending;
  assert.equal(notes.length, 0);
});

test('fractional chord boundaries sound exactly and preserve bar duration',()=>{
 const {engine,chords}=instrumentSpy('swing',[['Bb','Bb/D','Eb']]);
 const events=[];do{const e=engine.timeline.next();events.push(e);engine.schedule(e);}while(engine.timeline.beat!==0);
 assert.deepEqual(events.map(e=>Number(e.beat.toFixed(6))),[0,1,1.333333,2,2.666667,3]);
 assert.ok(Math.abs(engine.timeline.time-2)<1e-9);
 assert.equal(events.filter(e=>e.chordBoundary).length,3);
 assert.ok(chords.length>=3);
});
test('uneven durations and rests advance without missing or doubling beats',()=>{
 const t={...tune,form:['A'],sections:{A:{bars:[['N.C.','C','G7']],barDurations:[[.5,2.5,1]]}}};
 const clock=new Timeline(t);const events=[];do{events.push(clock.next());}while(clock.beat!==0);
 assert.deepEqual(events.map(e=>e.beat),[0,.5,1,2,3]);assert.equal(clock.time,2);
 assert.deepEqual(events.filter(e=>e.chordBoundary).map(e=>e.chord),['N.C.','C','G7']);
});
test('eighth-note meters use correct elapsed bar time',()=>{
 const t={...tune,timeSignature:'6/8',form:['A'],sections:{A:{bars:[['C']]}}};
 const clock=new Timeline(t);for(let i=0;i<6;i++)clock.next();assert.equal(clock.time,1.5);assert.equal(clock.beat,0);
});
test('stopping during sample preparation prevents delayed playback',async()=>{
 const engine=new AudioEngine();engine.initialize=async()=>{};let ready;engine.prepareSamples=()=>new Promise(resolve=>{ready=resolve;});
 const pending=engine.play(tune);await Promise.resolve();engine.stop();ready();await pending;assert.equal(engine.playing,false);assert.equal(engine.timeline,undefined);
});

test('pause and resume preserve the exact audio clock, timeline and scheduled notes',async()=>{
 const engine=new AudioEngine();let suspended=0,resumed=0,stopped=0,ticks=0;
 engine.context={currentTime:2.375,suspend:async()=>{suspended++;},resume:async()=>{resumed++;}};
 engine.playing=true;engine.timeline=new Timeline(tune,{startTime:2});engine.timeline.next();
 const timeline=engine.timeline,queue=[{time:2.5,beat:1}];engine.queue=queue;engine.sources.add({stop(){stopped++;}});engine.tick=()=>ticks++;
 await engine.pause();assert.equal(engine.paused,true);assert.equal(engine.playing,false);assert.equal(suspended,1);assert.equal(stopped,0);assert.equal(engine.context.currentTime,2.375);
 await engine.resume();assert.equal(engine.timeline,timeline);assert.equal(engine.queue,queue);assert.equal(engine.timeline.time,2.5);assert.equal(engine.paused,false);assert.equal(engine.playing,true);assert.equal(resumed,1);assert.equal(ticks,1);
 engine.stop();
});
test('restart discards the paused position and starts a fresh timeline',async()=>{
 const engine=new AudioEngine();engine.context={currentTime:10};engine.initialize=async()=>{};engine.prepareSamples=async()=>{};engine.tick=()=>{};
 engine.paused=true;engine.timeline=new Timeline(tune);for(let i=0;i<9;i++)engine.timeline.next();
 await engine.play(tune,{countIn:false});assert.equal(engine.paused,false);assert.equal(engine.timeline.formIndex,0);assert.equal(engine.timeline.barIndex,0);assert.equal(engine.timeline.beat,0);assert.equal(engine.timeline.time,10.08);engine.stop();
});
test('preview while paused uses separate audio without resuming the song',async()=>{
 const engine=new AudioEngine();engine.paused=true;let previewed;
 engine.previewEngine={preview:async pitches=>{previewed=pitches;},stop(){}};
 await engine.preview([60]);assert.deepEqual(previewed,[60]);assert.equal(engine.paused,true);assert.equal(engine.playing,false);
});

test('practice phrase preview uses a separate clock and exact meter timing',async()=>{
 const parent=new AudioEngine(),player=new EventTarget(),scheduled=[];
 parent.context={currentTime:17};parent.paused=true;
 Object.assign(player,{generation:0,context:{currentTime:2},initialize:async()=>{},prepareSamples:async()=>{},previewFilter:{},phraseNote:(pitch,time,duration)=>scheduled.push({pitch,time,duration}),stop(){this.generation++;this.dispatchEvent(new Event('stop'));}});
 parent.previewEngine=player;
 const playing=parent.previewPhrase([{pitch:64,beat:0,duration:1},{pitch:65,beat:3,duration:.5}],{tempo:120,beatValue:8});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(scheduled.length,2);assert.ok(Math.abs(scheduled[1].time-scheduled[0].time-.75)<1e-8);assert.equal(parent.context.currentTime,17);assert.equal(parent.paused,true);
 player.stop();await playing;
});

test('suggested phrases schedule on their bar clock with fractional beats and melody routing',()=>{
 const engine=new AudioEngine(),heard=[];engine.context={currentTime:1};engine.timeline={beatsPerBar:4};engine.hearPhrases=true;engine.soloFilter={track:'solo'};
 engine.setSoloPhrases([{id:'0-0',formIndex:0,bars:[{barIndex:0},{barIndex:1}],riff:[{pitch:64,beat:0,duration:.5},{pitch:67,beat:3.5,duration:.5},{pitch:69,beat:4.5,duration:.5}]}]);
 engine.phraseNote=(pitch,time,duration,destination)=>heard.push({pitch,time,duration,destination});
 engine.scheduleSoloPhrase({formIndex:0,barIndex:0,beat:0,time:1.25,duration:.5,countIn:false},1);
 engine.scheduleSoloPhrase({formIndex:0,barIndex:1,beat:0,time:4,duration:1,countIn:false},1);
 assert.deepEqual(heard.map(n=>[n.pitch,n.time,n.duration]),[[64,1.25,.25],[67,3,.25],[69,4.5,.5]]);assert.ok(heard.every(n=>n.destination===engine.soloFilter));
});

test('suggested phrases retrigger at loop starts but ignore count-in and non-start bars',()=>{
 const engine=new AudioEngine();let notes=0;engine.context={currentTime:0};engine.timeline={beatsPerBar:4};engine.hearPhrases=true;engine.setSoloPhrases([{formIndex:2,bars:[{barIndex:0}],riff:[{pitch:60,beat:0,duration:1}]}]);engine.phraseNote=()=>notes++;
 const start={formIndex:2,barIndex:0,beat:0,time:0,duration:.5,countIn:false};engine.scheduleSoloPhrase(start);engine.scheduleSoloPhrase({...start,time:2});
 engine.scheduleSoloPhrase({...start,countIn:true});engine.scheduleSoloPhrase({...start,barIndex:1});assert.equal(notes,2);
});

test('turning suggested phrases off cancels queued phrase notes without changing its phrase plan',()=>{
 const engine=new AudioEngine();let stopped=0;engine.setSoloPhrases([{id:'keep'}]);engine.phraseSources.add({stop(){stopped++;}});engine.hearPhrases=true;engine.hearPhrases=false;
 assert.equal(stopped,1);assert.equal(engine.phraseSources.size,0);assert.deepEqual(engine.soloPhrases,[{id:'keep'}]);
});

test('canceling a phrase while samples load prevents late preview audio',async()=>{
 const parent=new AudioEngine(),player=new EventTarget();let ready,scheduled=0;
 Object.assign(player,{generation:0,context:{currentTime:0},initialize:async()=>{},prepareSamples:()=>new Promise(resolve=>{ready=resolve;}),chord:()=>scheduled++,stop(){this.generation++;this.dispatchEvent(new Event('stop'));}});
 parent.previewEngine=player;
 const playing=parent.previewPhrase([{pitch:64,beat:0,duration:1}]);await new Promise(resolve=>setImmediate(resolve));player.stop();ready();await playing;assert.equal(scheduled,0);
});

 test('solo and melody controls remain independent',()=>{
 const engine=new AudioEngine();engine.hearMelody=true;engine.hearPhrases=true;engine.setTrack('solo',{muted:true,volume:.2});
 assert.equal(engine.hearMelody,true);assert.equal(engine.tracks.melody.muted,false);assert.equal(engine.tracks.melody.volume,.7);
 engine.hearPhrases=false;assert.equal(engine.hearMelody,true);engine.hearPhrases=true;engine.hearMelody=false;assert.equal(engine.hearPhrases,true);
 });

test('solo highlights follow scheduled fractional notes and clear during rests and mute', () => {
  const engine=new AudioEngine();
  engine.playing=true;engine.hearPhrases=true;
  engine.timeline={beatsPerBar:4};engine.phraseNote=()=>{};
  engine.setSoloPhrases([{id:'0-0',formIndex:0,bars:[{barIndex:0}],riff:[
    {beat:0,duration:1/3,pitch:64,string:2,fret:5},
    {beat:1/3,duration:1/3,pitch:65,string:2,fret:6},
    {beat:1,duration:1,pitch:67,string:2,fret:8},
  ]}]);
  const seen=[];engine.addEventListener('solo-note',event=>seen.push(event.detail?.fret??null));
  engine.scheduleSoloPhrase({formIndex:0,barIndex:0,beat:0,time:10,duration:.5},9.9);
  engine.updateSoloNote(9.99);assert.equal(engine.activeSoloNote,null);
  engine.updateSoloNote(10);assert.equal(engine.activeSoloNote.fret,5);
  assert.equal(engine.activeSoloNote.phraseId,'0-0');
  engine.updateSoloNote(10.17);assert.equal(engine.activeSoloNote.fret,6);
  engine.updateSoloNote(10.4);assert.equal(engine.activeSoloNote,null);
  engine.updateSoloNote(10.5);assert.equal(engine.activeSoloNote.fret,8);
  engine.setTrack('solo',{muted:true});assert.equal(engine.activeSoloNote,null);
  engine.setTrack('solo',{muted:false});engine.updateSoloNote(10.6);
  assert.equal(engine.activeSoloNote.fret,8);
  engine.hearPhrases=false;assert.equal(engine.activeSoloNote,null);
  assert.equal(engine.soloNoteQueue.length,0);
  assert.deepEqual(seen,[5,6,null,8,null,8,null]);
});

test('solo voice applies per-note dynamics to both sample and fallback voices',()=>{
 const engine=new AudioEngine(),levels=[];
 engine.samples={};engine.sample=(...args)=>{levels.push(args[5]);return {};};
 engine.phraseNote(64,1,.4,{},.7);engine.phraseNote(65,2,.2,{},1.08);
 assert.ok(levels[1]>levels[0]);
 engine.samples=null;engine.tone=(...args)=>{levels.push(args[4]);return {};};
 engine.phraseNote(64,3,.4,{},.7);engine.phraseNote(65,4,.2,{},1.08);
 assert.ok(levels[3]>levels[2]);
});

test('held solo notes cross display cards without a second audio attack',()=>{
 const engine=new AudioEngine();engine.hearPhrases=true;engine.timeline={beatsPerBar:4};
 const attacks=[];engine.phraseNote=(...args)=>attacks.push(args);
 engine.setSoloPhrases([
  {id:'0-0',formIndex:0,bars:[{barIndex:0},{barIndex:1}],riff:[{beat:7.5,duration:1,pitch:64,string:2,fret:5}]},
  {id:'0-2',formIndex:0,bars:[{barIndex:2},{barIndex:3}],riff:[{beat:0,duration:.5,pitch:64,string:2,fret:5,tie:true},{beat:1,duration:.5,pitch:65,string:2,fret:6}]},
 ]);
 engine.scheduleSoloPhrase({formIndex:0,barIndex:1,beat:0,time:2,duration:.5},2);
 engine.scheduleSoloPhrase({formIndex:0,barIndex:2,beat:0,time:4,duration:.5},4);
 assert.deepEqual(attacks.map(a=>[a[0],a[1]]),[[64,3.75],[65,4.5]]);
 assert.ok(engine.soloNoteQueue.some(n=>n.phraseId==='0-2'&&n.tie));
});

test('solo feel offsets attacks without moving releases or visual timing',()=>{
 const engine=new AudioEngine();engine.hearPhrases=true;engine.timeline={beatsPerBar:4};
 const attacks=[];engine.phraseNote=(...args)=>attacks.push(args);
 engine.setSoloPhrases([{id:'0-0',formIndex:0,bars:[{barIndex:0}],riff:[{beat:1,duration:.8,pitch:64,timingOffset:.012}]}]);
 engine.scheduleSoloPhrase({formIndex:0,barIndex:0,beat:0,time:2,duration:.5},2);
 assert.equal(attacks[0][1],2.512);
 assert.ok(Math.abs(attacks[0][1]+attacks[0][2]-2.9)<1e-7);
 assert.equal(engine.soloNoteQueue[0].time,attacks[0][1]);
 assert.equal(engine.soloNoteQueue[0].end,2.9);
});
