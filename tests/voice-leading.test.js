import test from 'node:test';import assert from 'node:assert/strict';
import {chooseShape,fretCenter} from '../src/voice-leading.js';
import {chordPitchClasses,mod12} from '../src/theory.js';
import {nearestSample} from '../src/audio/samples.js';
test('common turnaround stays near the hand position and preserves chord tones',()=>{
 let previous=null;
 for(const chord of ['Em7','A7','Dm7','G7','Cmaj7']){const shape=chooseShape(chord,previous,{zone:'high'});if(previous)assert.ok(Math.abs(fretCenter(shape)-fretCenter(previous))<=5,chord);assert.ok(shape.pitches.every(p=>chordPitchClasses(chord).includes(mod12(p))));previous=shape;}
});
test('practice zones offer distinct areas and rotate by chorus',()=>{
 const low=chooseShape('Em7',null,{zone:'low'}),high=chooseShape('Em7',null,{zone:'high'});assert.ok(fretCenter(high)-fretCenter(low)>=5);
 const centers=[0,1,2].map(chorus=>fretCenter(chooseShape('Cmaj7',null,{zone:'explore',chorus})));assert.ok(new Set(centers).size>=2);
});
test('sample transposition starts with the nearest recorded note',()=>{assert.equal(nearestSample([{midi:48},{midi:51},{midi:54}],52).midi,51);});
test('chart and live reminder can share one deterministic fingering plan',async()=>{
 const {planShapes}=await import('../src/voice-leading.js');const tune={form:['A','B'],sections:{A:{bars:[['Em7','A7']]},B:{bars:[['Dm7','G7']]}}};
 const plan=planShapes(tune,{zone:'middle'});assert.deepEqual(Object.keys(plan),['0-0-0','0-0-1','1-0-0','1-0-1']);
 assert.equal(plan['1-0-0'].chord,'Dm7');assert.deepEqual(plan,planShapes(tune,{zone:'middle'}));
});
test('selected inversions put the requested chord tone in the bass',()=>{
 for(const [chord,tones] of [['Cmaj7',[0,4,7,11]],['Dm7',[2,5,9,0]]])for(let inversion=0;inversion<4;inversion++){
  const shape=chooseShape(chord,null,{inversion:String(inversion)});
  assert.equal(mod12(Math.min(...shape.pitches)),tones[inversion],`${chord} inversion ${inversion}`);
 }
});
test('solo targets stay in one position and belong to each chord',async()=>{
 const {soloTargets}=await import('../src/solo-guide.js');const tune={form:['A'],sections:{A:{bars:[['Cm7'],['F7'],['Bbmaj7'],['N.C.']]}}};const plan=soloTargets(tune,5);
 for(let i=0;i<3;i++){const t=plan[`0-${i}-0`];assert.ok(t.fret>=5&&t.fret<=8);assert.ok(t.string<=6);assert.ok(chordPitchClasses(tune.sections.A.bars[i][0]).includes(mod12(t.pitch)));}assert.equal(plan['0-3-0'],null);
});
test('nearby vocabulary keeps a target, bounded chord tones and distinct passing notes',async()=>{
 const {soloTargets,nearbyNotes}=await import('../src/solo-guide.js');const tune={form:['A'],sections:{A:{bars:[['Cm7'],['F7']]}}};const targets=soloTargets(tune,7),scale=[10,0,2,3,5,7,9];
 for(const [i,chord] of ['Cm7','F7'].entries()){
  const target=targets[`0-${i}-0`],dots=nearbyNotes(chord,target,7,scale);assert.ok(dots.length>1&&dots.length<=12);assert.equal(dots[0].pitch,target.pitch);assert.equal(dots[0].emphasis,'root');assert.deepEqual([...new Set(dots.map(d=>d.string))].sort(),[1,2,3,4,5,6]);assert.equal(new Set(dots.map(d=>`${d.string}-${d.fret}`)).size,dots.length);
  for(const dot of dots){assert.ok(dot.fret>=7&&dot.fret<=10&&dot.string<=6);if(dot.emphasis)assert.ok(chordPitchClasses(chord).includes(mod12(dot.pitch)));else assert.ok(scale.includes(mod12(dot.pitch)));}
 }
 assert.deepEqual(nearbyNotes('N.C.',null,7,scale),[]);
});
