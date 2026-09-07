import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {melodyTab} from '../src/chord-melody.js';import {transposeTune} from '../src/transpose.js';
import {tune} from './fixtures/synthetic.js';
test('melody tab shows only the actual melody and fits each bar',()=>{
 for(const section of Object.values(tune.sections))section.melody.forEach((events,i)=>{assert.equal(events.reduce((n,e)=>n+e.duration,0),4);for(const e of melodyTab(events,section.bars[i]))if(e.midi!==null){assert.ok(e.shape);assert.equal(e.shape.pitches.length,1);assert.equal(e.shape.frets.filter(f=>f!==null).length,1);assert.equal(Math.max(...e.shape.pitches),e.midi);const frets=e.shape.frets.filter(f=>f>0);assert.ok(Math.max(...frets)-Math.min(...frets)<=3);}});
});
test('melody notes transpose with the song',()=>{const changed=transposeTune(tune,'D');assert.equal(changed.sections.A.melody[0][1].midi,62);assert.equal(changed.sections.A.melody[0][0].midi,null);});

test('melody phrases choose nearby frets rather than climb one string',()=>{const notes=[67,70,72,74].map((midi,i)=>({midi,beat:i,duration:1}));const frets=melodyTab(notes,['C']).map(n=>n.shape.fret);assert.ok(Math.max(...frets)-Math.min(...frets)<=4);});
