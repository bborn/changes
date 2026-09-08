import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {parseChord,chordPitchClasses,getVoicings,scalePitchClasses,notePc,TUNING,mod12} from '../src/theory.js';
import library from '../data/voicings.js';
import {suggestSection,scaleForChord} from '../data/scales.js';
const qualities=['maj7','m7','7','m7b5','dim7','6','m6','9','13','7b9','7#9','7#11','sus4','','m'];
test('parses the complete handoff grammar, accidentals and slash bass',()=>{
  for(const quality of qualities) assert.equal(parseChord('Bb'+quality).rootPc,10);
  assert.deepEqual(parseChord('C7b9/E'),{root:'C',rootPc:0,quality:'7',extensions:['b9'],bass:'E'});
  assert.deepEqual(parseChord('F#13').extensions,['13']);
  for(const invalid of ['H7','Cwhat','C7/','Cmaj7nope','']) assert.throws(()=>parseChord(invalid));
});
test('parenthesized alterations match bare notation without accepting malformed groups',()=>{
 for(const [symbol,bare] of [['Am7(b5)','Am7b5'],['D7(b9)','D7b9'],['C7(b9,#11)/E','C7b9#11/E'],['Am7(♭5)','Am7b5']]) {
  assert.deepEqual(parseChord(symbol),parseChord(bare));
  assert.deepEqual(chordPitchClasses(symbol),chordPitchClasses(bare));
  assert.deepEqual(getVoicings(symbol),getVoicings(bare));
 }
 for(const symbol of ['Am7(b5','Am7b5)','Am7((b5))','Am7()','Am7(nope)','C7(b9,)']) assert.throws(()=>parseChord(symbol));
});
test('chord tones preserve altered fifth and diminished seventh',()=>{
 assert.deepEqual(chordPitchClasses('Cm7b5'),[0,3,6,10]);
 assert.deepEqual(chordPitchClasses('Cdim7'),[0,3,6,9]);
 assert.deepEqual(chordPitchClasses('C7b9'),[0,4,7,10,1]);
});
test('every quality has three playable, correctly pitched voicings in all keys',()=>{
 for(const root of ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']) for(const quality of qualities){
  const symbol=root+quality;const allowed=chordPitchClasses(symbol);const voicings=getVoicings(symbol);
  assert.equal(voicings.length,3,symbol);
  for(const v of voicings){
   const frets=v.frets.filter(f=>f!==null);
   assert.ok(Math.min(...frets)>=1,symbol);
   assert.ok(Math.max(...frets)-Math.min(...frets)<=4,symbol);
   assert.ok(v.pitches.every(p=>allowed.includes(mod12(p))),`${symbol} ${v.name}: ${v.pitches}`);
   assert.deepEqual(v.pitches,v.frets.flatMap((f,i)=>f===null?[]:[f+TUNING[i]]));
   if(!quality.includes('9')&&!quality.includes('13')&&!quality.includes('#11')) assert.deepEqual([...new Set(v.pitches.map(mod12))].sort(),[...allowed].sort(),symbol);
  }
 }
});
test('slash chords put the requested note at the bottom',()=>{
 for(const symbol of ['C/E','Dm7/F','G7/B']) for(const v of getVoicings(symbol)) {
  assert.equal(mod12(Math.min(...v.pitches)),notePc(parseChord(symbol).bass));
  const bassIndex=v.frets.findIndex(f=>f!==null);
  assert.ok(v.name.endsWith(`fret ${v.frets[bassIndex]}`));
 }
});
test('JSON library and synchronous browser library remain identical',async()=>assert.deepEqual(library,JSON.parse(await readFile(new URL('../data/voicings.json',import.meta.url),'utf8'))));
test('scale rules handle resolutions, diminished scales and section overrides',()=>{
 assert.equal(scaleForChord('D7','Gm7').alt,'D altered');
 assert.equal(scaleForChord('Bm7b5').alt,'B locrian ♮2');
 assert.equal(scalePitchClasses('C whole-half diminished').length,8);
 assert.deepEqual(scalePitchClasses('Bb dorian'),[10,0,1,3,5,7,8]);
 const tune={sections:{A:{bars:[['Dm7'],['G7'],['Cmaj7']]}}};
 const suggestion=suggestSection(tune,'A');
 assert.ok(chordPitchClasses('Cmaj7').every(pc=>scalePitchClasses(suggestion.primary).includes(pc)));
 assert.throws(()=>scalePitchClasses('C imaginary'));
});
