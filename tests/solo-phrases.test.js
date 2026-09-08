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
 assert.ok(p.riff.length>=4&&p.riff.length<=14);assert.ok(new Set(p.riff.map(n=>n.pitch)).size>=3);
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
 assert.ok(swung.some(n=>Math.abs(n.beat-n.writtenBeat)>1e-7));
 assert.ok(straight.every(n=>Math.abs(n.beat-n.writtenBeat)<1e-7));
});

test('target voice leading carries across phrase boundaries',()=>{
 const phrases=buildSoloPhrases(tune([['Cmaj7'],['F7'],['Bm7b5']]));const before=phrases[0].events.at(-1).target,after=phrases[1].events[0].target;
 assert.ok(Math.abs(after.pitch-before.pitch)<=6,`${before.pitch} to ${after.pitch}`);
});

test('difficulty increases rhythmic density while beginner stays on quarter-note chord tones',()=>{
 const t=tune([['Dm7'],['G7']]);t.style='swing';
 const [easy,medium,hard]=['beginner','intermediate','advanced'].map(level=>buildSoloPhrases(t,5,{level})[0]);
 assert.ok(easy.riff.every(n=>Number.isInteger(n.beat)&&chordPitchClasses(easy.events.find(e=>e.key===n.eventKey).chord).includes(mod12(n.pitch))));
 assert.ok(easy.riff.length<medium.riff.length);assert.ok(hard.riff.length>=medium.riff.length);
 assert.ok(hard.riff.some(n=>!Number.isInteger(n.writtenBeat)));
 for(const p of [easy,medium,hard])for(const n of p.riff){const event=p.events.find(e=>e.key===n.eventKey);assert.ok(n.duration>0);assert.ok(validSustain(p,n));assert.ok(n.fret>=5&&n.fret<=8);}
 assert.deepEqual(easy.dots,hard.dots); // difficulty changes the example, not the stable map
 assert.deepEqual(buildSoloPhrases(t,5,{level:'advanced'})[0].riff,hard.riff);
});


test('every difficulty leaves breathing room across the sentence and varies rest placement',()=>{
 const t=tune(Array.from({length:8},()=>['Cmaj7']));t.style='swing';
 for(const level of ['beginner','intermediate','advanced']){
  const phrases=buildSoloPhrases(t,5,{level});
  const starts=[];let offset=0,occupied=0;
  for(const p of phrases){
   occupied+=p.riff.filter(n=>!n.tie).reduce((sum,n)=>sum+n.duration,0);
   starts.push(...p.riff.filter(n=>!n.tie).map(n=>n.beat+offset));
   const last=p.riff.at(-1),event=p.events.find(e=>e.key===last.eventKey);
   if(p.sentenceEnd)assert.equal(last.pitch,event.target.pitch);
   offset+=p.beats;
  }
  assert.ok(occupied<offset*.85,`${level} needs breathing room`);
  const rests=starts.slice(1).map((beat,i)=>beat-starts[i]).filter(gap=>gap>=1);
  assert.ok(rests.length>=2,`${level} needs audible breaths`);
  assert.ok(new Set(rests.map(gap=>gap.toFixed(3))).size>=2,`${level} rest lengths should vary`);
 }
});

test('phrase articulation accents pickups and tapers endings without changing swing timing',()=>{
 const t=tune([['Dm7'],['G7']]);t.style='swing';
 const p=buildSoloPhrases(t)[0];
 assert.ok(new Set(p.riff.map(n=>n.velocity)).size>=3);
 assert.ok(p.riff.at(-1).velocity<p.riff[0].velocity);
 const pickup=p.riff.find(n=>!Number.isInteger(n.beat));
 assert.ok(pickup&&pickup.velocity>=p.riff[0].velocity);
 assert.ok(p.riff.every(n=>n.duration>0&&n.velocity>=.4&&n.velocity<=1.2));
});

test('advanced gestures travel through pitches instead of oscillating between two notes',()=>{
 for(const chords of [['Cmaj7','Cmaj7'],['Dm7','G7'],['Fmaj7','Gb7']]){
  const t=tune(chords.map(chord=>[chord]));t.style='swing';
  const p=buildSoloPhrases(t,5,{level:'advanced'})[0],pitches=p.riff.map(n=>n.pitch);
  assert.ok(new Set(pitches).size>=4,`${chords}: ${pitches}`);
  assert.ok(Math.max(...pitches)-Math.min(...pitches)>=7);
  assert.ok(!pitches.some((pitch,i)=>i>=3&&pitch===pitches[i-2]&&pitches[i-1]===pitches[i-3]),'no unintended ABAB loops');
  assert.ok(pitches.slice(1).every((pitch,i)=>Math.abs(pitch-pitches[i])<=7));
  const last=p.riff.at(-1);assert.equal(last.pitch,p.events.find(e=>e.key===last.eventKey).target.pitch);
 }
});


test('connected phrases may sustain compatible tones across bar and card lines',()=>{
 for(const meter of ['3/4','4/4'])for(const level of ['beginner','intermediate','advanced']){
  const phrases=buildSoloPhrases(tune([['Dm7'],['G7'],['Cmaj7'],['Am7']],{meter}),5,{level});
  const bar=Number(meter[0]);
  assert.ok(phrases.some(p=>p.riff.some(n=>n.beat<bar&&n.beat+n.duration>bar)),`${level} ${meter} should cross a measure`);
  for(const p of phrases)assert.ok(p.riff.every(n=>validSustain(p,n)));
  const lastPhrase=phrases.at(-1),last=lastPhrase.riff.at(-1);
  assert.ok(last.beat+last.duration<lastPhrase.beats-.5,'breath at sentence ending');
 }
});

test('long arrangements contain deterministic gestures lasting beyond two bars',()=>{
 const t=tune(Array.from({length:8},(_,i)=>[i%2?'Am7':'Cmaj7']));t.style='bossa';
 const phrases=buildSoloPhrases(t,5,{level:'advanced'});
 assert.equal(new Set(phrases.map(p=>p.sentence)).size,1);
 const starts=[];let offset=0;
 for(const p of phrases){starts.push(...p.riff.filter(n=>!n.tie).map(n=>({...n,absoluteBeat:n.beat+offset})));offset+=p.beats;}
 let longest=0,runStart=starts[0]?.absoluteBeat;
 for(let i=1;i<starts.length;i++){
  const previous=starts[i-1],gap=starts[i].absoluteBeat-(previous.absoluteBeat+previous.duration);
  if(gap>.55){longest=Math.max(longest,previous.absoluteBeat+previous.duration-runStart);runStart=starts[i].absoluteBeat;}
 }
 longest=Math.max(longest,(starts.at(-1)?.absoluteBeat??0)+(starts.at(-1)?.duration??0)-runStart);
 assert.ok(longest>8,`expected a passage beyond two bars, got ${longest} beats`);
 assert.deepEqual(buildSoloPhrases(t,5,{level:'advanced'}),phrases);
});

test('advanced sentences contrast sparse holds, long eighth runs, and rare triplet color',()=>{
 const t=tune(Array.from({length:8},(_,i)=>[i%2?'G7':'Dm7']));t.style='bossa';
 const phrases=buildSoloPhrases(t,5,{level:'advanced'}),line=[];let offset=0;
 for(const phrase of phrases){line.push(...phrase.riff.filter(n=>!n.tie).map(n=>({...n,absoluteBeat:n.beat+offset,absoluteWritten:n.writtenBeat+offset})));offset+=phrase.beats;}
 const triplets=line.filter(n=>Math.abs(n.absoluteWritten*2-Math.round(n.absoluteWritten*2))>1e-7);
 assert.ok(triplets.length>0&&triplets.length/line.length<.15,`${triplets.length}/${line.length} attacks use triplets`);
 assert.ok(line.filter(n=>n.writtenDuration>=1.5).length>=2,'the sparse statements need substantial held notes');
 let current=[],longest=[];
 for(const note of line){
  if(current.length&&Math.abs(note.absoluteWritten-current.at(-1).absoluteWritten-.5)>1e-7)current=[];
  current.push(note);if(current.length>longest.length)longest=[...current];
 }
 assert.ok(longest.length>=12,`expected a multi-bar eighth-note run, got ${longest.length} attacks`);
 assert.ok(new Set(longest.map(n=>n.pitch)).size>=5,'the run should travel through several pitches');
});

test('guitar techniques are feasible and remain absent from non-guitar lines',()=>{
 const t=tune(Array.from({length:8},()=>['Cmaj7']));t.style='swing';
 const guitar=buildSoloPhrases(t,5,{level:'advanced'}).flatMap(p=>p.riff);
 const articulations=guitar.filter(n=>n.articulation);
 assert.ok(articulations.length>=3);
 for(const note of articulations){
  assert.ok(['hammer','pull','slide'].includes(note.articulation.type));
  assert.equal(note.string,note.articulation.fromString);
  assert.equal(note.pitch-note.articulation.fromPitch,note.fret-note.articulation.fromFret);
  assert.ok(Math.abs(note.fret-note.articulation.fromFret)<=4);
 }
 const harmonies=guitar.filter(n=>n.harmony);
 assert.ok(harmonies.length>=2);
 for(const note of harmonies){
  const event=buildSoloPhrases(t,5,{level:'advanced'}).flatMap(p=>p.events).find(e=>e.key===note.eventKey);
  assert.equal(Math.abs(note.string-note.harmony.string),1);assert.notEqual(note.pitch,note.harmony.pitch);
  assert.ok(chordPitchClasses(event.chord).includes(mod12(note.pitch)));
  assert.ok(chordPitchClasses(event.chord).includes(mod12(note.harmony.pitch)));
 }
 assert.ok(buildSoloPhrases(t,5,{level:'beginner'}).flatMap(p=>p.riff).every(n=>!n.articulation&&!n.harmony));
 for(const instrument of ['piano','other'])assert.ok(buildSoloPhrases(t,5,{level:'advanced',instrument}).flatMap(p=>p.riff).every(n=>!n.articulation&&!n.harmony));
});

test('double stops remain chord tones through every harmony they sustain across',()=>{
 const t=tune([['G7'],['Em7'],['Cmaj7'],['Am7'],['Bb7'],['Dm7'],['Fmaj7'],['E7']]);t.style='bossa';
 const phrases=buildSoloPhrases(t,5,{level:'advanced'});
 for(const phrase of phrases)for(const note of phrase.riff.filter(n=>n.harmony)){
  const crossed=phrase.events.filter(event=>event.beat<note.beat+note.duration-1e-7&&event.beat+event.duration>note.beat+1e-7);
  assert.ok(crossed.length);
  assert.ok(crossed.every(event=>event.chord!=='N.C.'&&chordPitchClasses(event.chord).includes(mod12(note.harmony.pitch))),`${note.harmony.label} is unsafe from beat ${note.beat}`);
 }
});

test('chord and form identity deterministically displaces rhythmic openings',()=>{
 const a=buildSoloPhrases(tune(Array.from({length:6},()=>['Cmaj7'])),5,{level:'intermediate'}).flatMap(p=>p.riff.filter(n=>!n.tie).map(n=>n.writtenBeat));
 const b=buildSoloPhrases(tune(Array.from({length:6},()=>['Dm7'])),5,{level:'intermediate'}).flatMap(p=>p.riff.filter(n=>!n.tie).map(n=>n.writtenBeat));
 assert.notDeepEqual(a,b);
});


test('neighboring cards share a composed sentence and preserve crossing notes as ties',()=>{
 const ps=buildSoloPhrases(tune(Array.from({length:4},()=>['Cmaj7'])),5,{level:'intermediate'});
 assert.equal(ps[0].sentence,ps[1].sentence);
 assert.equal(ps[0].sentenceEnd,false);assert.equal(ps[1].sentenceEnd,true);
 const held=ps[0].riff.find(n=>n.beat+n.duration>ps[0].beats),continuation=ps[1].riff.find(n=>n.tie);
 assert.equal(Boolean(held),Boolean(continuation));
 if(held){assert.equal(continuation.pitch,held.pitch);assert.equal(continuation.beat,0);assert.ok(Math.abs(continuation.duration-(held.beat+held.duration-ps[0].beats))<1e-7);}
 assert.ok(ps[1].riff.at(-1).beat+ps[1].riff.at(-1).duration<ps[1].beats-.8);
});

test('piano and other phrases use chromatic registers independent of guitar frets',()=>{
 const tune={key:'C',style:'bossa',timeSignature:'4/4',form:['A'],sections:{A:{bars:[['Cmaj7'],['Dm7'],['G7'],['Cmaj7']]}}};
 for(const instrument of ['piano','other'])for(const [register,base] of Object.entries({low:48,middle:60,high:72})){
  const options={instrument,register,level:'advanced'};
  const phrases=buildSoloPhrases(tune,1,options);
  assert.deepEqual(phrases,buildSoloPhrases(tune,12,options));
  assert.ok(phrases.some(p=>p.riff.length));
  for(const phrase of phrases){
   for(const n of [...phrase.dots,...phrase.riff]){assert.ok(n.pitch>=base&&n.pitch<base+24);assert.equal(n.string,undefined);assert.equal(n.fret,undefined);}
   for(const e of phrase.events)assert.ok(chordPitchClasses(e.chord).includes(e.target.pitch%12));
  }
 }
});

test('guide-note spelling wraps seven letter names without spurious accidentals',()=>{
 const tune={key:'Bb',style:'swing',timeSignature:'4/4',form:['A'],sections:{A:{bars:[['Bbmaj7'],['Ebmaj7']]}}};
 const phrases=buildSoloPhrases(tune,3);
 assert.ok(phrases.flatMap(p=>p.dots).every(n=>!n.label.includes('bbb')&&!n.label.includes('###')));
});
