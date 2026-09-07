import test from 'node:test';
import assert from 'node:assert/strict';
import {PRACTICE_LOOPS,createPracticeLoop} from '../src/practice-loops.js';
import {validateTune} from '../backend/validation.js';
import {buildSoloPhrases} from '../src/solo-phrases.js';
test('every practice loop validates and supports the solo guide',()=>{
 assert.equal(new Set(PRACTICE_LOOPS.map(x=>x.id)).size,14);
 for(const loop of PRACTICE_LOOPS){const tune=createPracticeLoop(loop.id);validateTune(tune);assert.ok(buildSoloPhrases(tune).length,loop.id);assert.equal(tune.sections.A.melody,undefined);}
});
