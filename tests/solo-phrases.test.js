import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSoloPhrases,phraseForLocation} from '../src/solo-phrases.js';
import {chordPitchClasses,mod12,notePc} from '../src/theory.js';

const validSustain=(phrase,note)=>phrase.events.filter(e=>e.beat>note.beat&&e.beat<note.beat+note.duration-1e-7).every(e=>e.chord!=='N.C.'&&chordPitchClasses(e.chord).includes(mod12(note.pitch)));
const tune=(bars,{form=['A'],meter='4/4',durations}={})=>({timeSignature:meter,form,sections:{A:{bars,barDurations:durations},B:{bars:[['Fmaj7'],['G7'],['Cmaj7']]}}});

test('pairs bars within each form section and keeps repeated occurrences addressable',()=>{
 const t=tune([['Cmaj7'],['Dm7'],['G7']],{form:['A','A','B']});const phrases=buildSoloPhrases(t);
 assert.deepEqual(phrases.map(p=>[p.id,p.section,p.bars.length]),[['0-0','A',2],['0-2','A',1],['1-0','A',2],['1-2','A',1],['2-0','B',2],['2-2','B',1]]);
 assert.equal(phraseForLocation(phrases,1,2).id,'1-2');assert.equal(buildSoloPhrases(t,5,{loop:'B'}).length,2);
 assert.deepEqual(buildSoloPhrases(t,5,{loop:'A'}).map(p=>p.id),['0-0','0-2']);
});

test('rapid and uneven chord changes retain exact phrase offsets and durations',()=>{
 const p=buildSoloPhrases(tune([['Cmaj7','D7','Gm7','C7'],['Fmaj7','A7','Dm7']],{durations:[[.5,.75,1.25,1.5],[2,.5,1.5]]}))[0];
 assert.deepEqual(p.events.map(e=>e.beat),[0,.5,1.25,2.5,4,6,6.5]);
 assert.deepEqual(p.events.map(e=>e.duration),[.5,.75,1.25,1.5,2,.5,1.5]);assert.equal(p.beats,8);
 assert.ok(p.events.every(e=>e.key===`${e.formIndex}-${e.barIndex}-${p.bars.find(b=>b.barIndex===e.barIndex).events.indexOf(e)}`));
});

test('meter controls phrase length and the second bar offset',()=>{
 const p=buildSoloPhrases(tune([['Cm7'],['F7']],{meter:'3/4'}))[0];assert.equal(p.beats,6);assert.deepEqual(p.events.map(e=>e.beat),[0,3]);
});

test('common dots really are chord tones of every sounding chord',()=>{
 const p=buildSoloPhrases(tune([['Cmaj7','Db7','Dmaj7','Eb7'],['Em7','A7']]))[0];
 const chords=p.events.filter(e=>e.chord!=='N.C.').map(e=>chordPitchClasses(e.chord));
 for(const dot of p.dots.filter(d=>d.role==='common'))assert.ok(chords.every(pcs=>pcs.includes(mod12(dot.pitch))));
 assert.equal(p.dots.filter(d=>d.role==='common').length,0);
 assert.ok(p.dots.every(d=>p.dots.filter(x=>x.string===d.string).length<=2||d.role==='target'));
});

test('altered dominants do not expose unsafe parent-scale passing notes',()=>{
 const p=buildSoloPhrases(tune([['G7b9'],['G7#9']]))[0];
 const passing=p.dots.filter(d=>d.role==='passing').map(d=>mod12(d.pitch));
 assert.ok(!passing.includes(notePc('A'))); // natural 9 belongs to G mixolydian, not G altered
});

test('all-rest phrases are empty exercises while mixed rests preserve timing',()=>{
 const empty=buildSoloPhrases(tune([['N.C.'],['N.C.']]))[0];assert.deepEqual(empty.dots,[]);assert.deepEqual(empty.riff,[]);assert.ok(empty.events.every(e=>e.target===null));
 const mixed=buildSoloPhrases(tune([['N.C.','C']],{durations:[[1,3]]}))[0];assert.deepEqual(mixed.events.map(e=>[e.beat,e.duration]),[[0,1],[1,3]]);
});

test('transposition moves harmonic dot labels and keeps the four-fret window',()=>{
 const c=buildSoloPhrases(tune([['Cmaj7']]),5)[0],d=buildSoloPhrases(tune([['Dmaj7']]),5)[0];
 assert.ok(c.dots.every(n=>n.fret>=5&&n.fret<=8));assert.ok(d.dots.every(n=>n.fret>=5&&n.fret<=8));
 assert.notDeepEqual(c.events[0].target,d.events[0].target);assert.ok(d.dots.some(n=>mod12(n.pitch)===notePc('D')));
});

test('guide-tone targets use the chord spelling rather than a flat-only pitch name',()=>{
 const p=buildSoloPhrases(tune([['D7']]),5)[0];assert.equal(p.events[0].target.label,'F#');
 assert.equal(p.dots.find(d=>d.eventKeys?.includes('0-0-0')).label,'F#');
});

test('phrases develop a melodic line while keeping strong beats inside the harmony',()=>{
 const p=buildSoloPhrases(tune([['Dm7','G7'],['Cmaj7','A7']]))[0];
 assert.ok(p.riff.length>=4&&p.riff.length<=8);assert.ok(new Set(p.riff.map(n=>n.pitch)).size>=3);
 for(const note of p.riff){const event=p.events.find(e=>e.key===note.eventKey);if(Number.isInteger(note.beat)||note.role==='target')assert.ok(chordPitchClasses(event.chord).includes(mod12(note.pitch)));assert.ok(note.beat>=event.beat&&validSustain(p,note));assert.ok(note.fret>=5&&note.fret<=8);}
 assert.ok(p.riff.slice(1).every((n,i)=>Math.abs(n.pitch-p.riff[i].pitch)<=7));
});

test('rapid uneven changes preserve deliberate rests without sustaining through new harmony',()=>{
 const p=buildSoloPhrases(tune([['Cmaj7','D7','Gm7','C7'],['Fmaj7']],{durations:[[.5,.75,1.25,1.5]]}))[0];
 assert.ok(p.events.some(event=>!p.riff.some(n=>n.beat===event.beat))); // Silence survives chord changes.
 for(const note of p.riff){const event=p.events.find(e=>e.key===note.eventKey);assert.ok(validSustain(p,note));}
});

test('swing phrases use long-short eighths, straight styles keep even eighths',()=>{
 const t=tune([['Dm7'],['G7']]);t.style='swing';const swung=buildSoloPhrases(t)[0].riff;
 t.style='bossa';const straight=buildSoloPhrases(t)[0].riff;
 assert.ok(swung.some(n=>Math.abs(n.beat-2/3)<1e-7));assert.ok(straight.some(n=>n.beat===.5));
});

test('target voice leading carries across phrase boundaries',()=>{
 const phrases=buildSoloPhrases(tune([['Cmaj7'],['F7'],['Bm7b5']]));const before=phrases[0].events.at(-1).target,after=phrases[1].events[0].target;
 assert.ok(Math.abs(after.pitch-before.pitch)<=6,`${before.pitch} to ${after.pitch}`);
});

test('difficulty increases rhythmic density while beginner stays on quarter-note chord tones',()=>{
 const t=tune([['Dm7'],['G7']]);t.style='swing';
 const [easy,medium,hard]=['beginner','intermediate','advanced'].map(level=>buildSoloPhrases(t,5,{level})[0]);
 assert.ok(easy.riff.every(n=>Number.isInteger(n.beat)&&chordPitchClasses(easy.events.find(e=>e.key===n.eventKey).chord).includes(mod12(n.pitch))));
 assert.ok(easy.riff.length<medium.riff.length);assert.ok(medium.riff.length<hard.riff.length);
 assert.ok(hard.riff.some(n=>Math.abs(n.beat-1/3)<1e-7));
 for(const p of [easy,medium,hard])for(const n of p.riff){const event=p.events.find(e=>e.key===n.eventKey);assert.ok(n.duration>0);assert.ok(validSustain(p,n));assert.ok(n.fret>=5&&n.fret<=8);}
 assert.deepEqual(easy.dots,hard.dots); // difficulty changes the example, not the stable map
 assert.deepEqual(buildSoloPhrases(t,5,{level:'advanced'})[0].riff,hard.riff);
});


test('every difficulty leaves breathing room and answers a recurring motif',()=>{
 const t=tune(Array.from({length:8},()=>['Cmaj7']));t.style='swing';
 for(const level of ['beginner','intermediate','advanced']){
  const phrases=buildSoloPhrases(t,5,{level});
  for(const p of phrases){
   const occupied=p.riff.reduce((sum,n)=>sum+n.duration,0);
   assert.ok(occupied<=p.beats*.7+1e-7,`${level}: ${occupied}/${p.beats}`);
   const gaps=p.riff.map((n,i)=>(p.riff[i+1]?.beat??p.beats)-(n.beat+n.duration));
   assert.ok(gaps.some(g=>g>=1),`${level} needs an audible breath`);
   const last=p.riff.at(-1),event=p.events.find(e=>e.key===last.eventKey);
   if(p.sentenceEnd)assert.equal(last.pitch,event.target.pitch);
  }
  assert.deepEqual(phrases[0].riff.map(n=>n.beat),phrases[2].riff.map(n=>n.beat));
  assert.ok(phrases[3].riff.length<=phrases[0].riff.length);
 }
});

test('phrase articulation accents pickups and tapers endings without changing swing timing',()=>{
 const t=tune([['Dm7'],['G7']]);t.style='swing';
 const p=buildSoloPhrases(t)[0];
 assert.ok(new Set(p.riff.map(n=>n.velocity)).size>=3);
 assert.ok(p.riff.at(-1).velocity<p.riff[0].velocity);
 const pickup=p.riff.find(n=>Math.abs(n.beat-2/3)<1e-7);
 assert.ok(pickup.velocity>p.riff[0].velocity);
 assert.ok(p.riff.every(n=>n.duration>0&&n.velocity>=.4&&n.velocity<=1.2));
});

test('advanced gestures travel through pitches instead of oscillating between two notes',()=>{
 for(const chords of [['Cmaj7','Cmaj7'],['Dm7','G7'],['Fmaj7','Gb7']]){
  const t=tune(chords.map(chord=>[chord]));t.style='swing';
  const p=buildSoloPhrases(t,5,{level:'advanced'})[0],pitches=p.riff.map(n=>n.pitch);
  assert.ok(new Set(pitches).size>=5,`${chords}: ${pitches}`);
  assert.ok(Math.max(...pitches)-Math.min(...pitches)>=7);
  assert.ok(!pitches.some((pitch,i)=>i>=3&&pitch===pitches[i-2]&&pitches[i-1]===pitches[i-3]),'no unintended ABAB loops');
  assert.ok(pitches.slice(1).every((pitch,i)=>Math.abs(pitch-pitches[i])<=7));
  const last=p.riff.at(-1);assert.equal(last.pitch,p.events.find(e=>e.key===last.eventKey).target.pitch);
 }
});


test('connected phrases use a pickup and sustain compatible tones across the bar line',()=>{
 for(const meter of ['3/4','4/4'])for(const level of ['beginner','intermediate','advanced']){
  const p=buildSoloPhrases(tune([['Dm7'],['G7']],{meter}),5,{level})[0];
  const bar=Number(meter[0]);
  assert.ok(p.riff.some(n=>n.beat<bar&&n.beat+n.duration>bar),`${level} ${meter} should cross the measure`);
  assert.ok(p.riff.every(n=>validSustain(p,n)));
  assert.ok(p.riff.at(-1).beat+p.riff.at(-1).duration<p.beats-.8,'breath at phrase ending');
 }
});


test('neighboring cards share a composed sentence and a held pickup without retriggering',()=>{
 const ps=buildSoloPhrases(tune(Array.from({length:4},()=>['Cmaj7'])),5,{level:'intermediate'});
 assert.equal(ps[0].sentence,ps[1].sentence);
 assert.equal(ps[0].sentenceEnd,false);assert.equal(ps[1].sentenceEnd,true);
 const held=ps[0].riff.find(n=>n.beat+n.duration>ps[0].beats);
 assert.ok(held,'line crosses the card boundary');
 const continuation=ps[1].riff[0];assert.equal(continuation.tie,true);
 assert.equal(continuation.pitch,held.pitch);assert.equal(continuation.beat,0);
 assert.ok(Math.abs(continuation.duration-(held.beat+held.duration-ps[0].beats))<1e-7);
 assert.ok(ps[1].riff.at(-1).beat+ps[1].riff.at(-1).duration<ps[1].beats-.8);
});
