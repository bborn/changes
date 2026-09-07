import test from 'node:test';import assert from 'node:assert/strict';
import {spellPitch,rhythmParts,notationEvents} from '../src/notation-model.js';
test('staff pitch spelling follows major and minor keys and octave boundaries',()=>{
 assert.equal(spellPitch(66,'G').key,'f#/4');assert.equal(spellPitch(66,'Gm').key,'f#/4');assert.equal(spellPitch(70,'Gm').key,'bb/4');assert.equal(spellPitch(59,'Gb').key,'cb/4');assert.equal(spellPitch(60,'C#').key,'b#/3');assert.equal(spellPitch(60,'C').key,'c/4');
});
test('notation durations preserve eighth notes, dotted notes, ties and tuplets',()=>{
 for(const d of [.125,.25,.5,.75,1,1.25,1.5,2,3,4,1/3,2/3])assert.ok(Math.abs(rhythmParts(d).reduce((n,p)=>n+p.quarters,0)-d)<.0001);
 assert.equal(rhythmParts(.75)[0].dots,1);assert.equal(rhythmParts(1/3)[0].ratio,1.5);assert.equal(rhythmParts(1.25).length,2);
});
test('6/8 uses eighth-note beat units and preserves rest timing',()=>{
 const parts=notationEvents([{midi:60,beat:0,duration:3},{midi:null,beat:3,duration:3}],'C','6/8');assert.equal(parts[0].duration,'4');assert.equal(parts[0].dots,1);assert.equal(parts[1].pitch,null);assert.equal(parts[1].beat,3);assert.equal(parts[1].durationBeats,3);
});
test('splitting a held note retains source event and continuation for highlights',()=>{
 const parts=notationEvents([{midi:60,beat:0,duration:1.25}],'C','4/4');assert.deepEqual(parts.map(p=>p.index),[0,0]);assert.equal(parts[1].continued,true);assert.equal(parts[1].beat,1);
});
