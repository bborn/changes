import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {convertChord,convertChart} from '../scripts/import-standards.mjs';
import {parseChord,chordPitchClasses,getVoicings,mod12} from '../src/theory.js';
const record=events=>({id:'test',chart:{file_metadata:{title:'Timing test',artist:'Composer'},sandbox:{expanded:true,genre:'Medium Swing',tempo:'0'},annotations:[{namespace:'timesig',data:[{value:{numerator:4,denominator:4}}]},{namespace:'key_mode',data:[{value:'C'}]},{namespace:'chord_ireal',data:events}]}});
test('import preserves uneven beat durations, extended harmony and slash bass',()=>{
 const tune=convertChart(record([{time:1,duration:3,value:'C^9'},{time:1.3,duration:1,value:'E7b9/B'}]));
 assert.deepEqual(tune.sections.A.bars,[['Cmaj9','E7b9/B']]);assert.ok(Math.abs(tune.sections.A.barDurations[0][1]-1)<1e-6);
 assert.equal(convertChord('F-^7'),'FmMaj7');assert.equal(convertChord('Bo'),'Bdim');
 assert.equal(convertChord('C7b9sus'),'C7sus4b9');
 assert.throws(()=>convertChart(record([{time:1,duration:2,value:'C'}])),/Incomplete/);
 assert.throws(()=>convertChart(record([{time:1,duration:4/3,value:'C'}])),/Incomplete/);
 assert.equal(convertChord('N'),'N.C.');
});
test('extended qualities preserve guide tones and produce playable voicings',()=>{
 for(const [symbol,required] of Object.entries({Cmaj9:[4,11,2],Cm9:[3,10,2],CmMaj7:[3,11],Cdim:[3,6],Caug:[4,8],C7sus4:[5,10],C7b5:[4,6,10],C7b13:[4,10,8],Cmaj7sharp11:[4,11,6]})){
  const name=symbol.replace('sharp','#');const pcs=chordPitchClasses(name);required.forEach(pc=>assert.ok(pcs.includes(pc),name));
  const shapes=getVoicings(name);assert.ok(shapes.length>=2,name);
  for(const shape of shapes){const played=shape.pitches.map(mod12);required.forEach(pc=>assert.ok(played.includes(pc),name));assert.ok(played.every(pc=>pcs.includes(pc)),name);}
 }
 assert.ok(!chordPitchClasses('C7b5').includes(7));assert.ok(!chordPitchClasses('Cmaj9').includes(10));
 assert.ok(!chordPitchClasses('Cdim').includes(9));assert.ok(parseChord('Cm6add9'));
});
