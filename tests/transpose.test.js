import test from 'node:test';import assert from 'node:assert/strict';
import {transposeChord,transposeTune} from '../src/transpose.js';
test('transposition preserves chord qualities, slash bass and rests',()=>{
 assert.equal(transposeChord('Em7/B',2),'Gb m7/Db'.replace(' ',''));assert.equal(transposeChord('E7b9',-2),'D7b9');assert.equal(transposeChord('N.C.',5),'N.C.');
});
test('transposing a tune preserves its timing and does not mutate the original',()=>{
 const tune={key:'C',form:['A'],sections:{A:{bars:[['Cmaj7','G7/B']],barDurations:[[3,1]]}}};
 const result=transposeTune(tune,'D');assert.deepEqual(result.sections.A.bars,[['Dmaj7','A7/Db']]);assert.deepEqual(result.sections.A.barDurations,[[3,1]]);assert.equal(tune.sections.A.bars[0][0],'Cmaj7');assert.deepEqual(transposeTune(result,'C'),tune);
});
