import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {rm} from 'node:fs/promises';
const output=new URL(`./.articulation-view-${process.pid}.cjs`,import.meta.url);
await build({stdin:{contents:"export {riffMeasure,neck} from '../src/react/Solo.jsx';",resolveDir:new URL('.',import.meta.url).pathname,loader:'jsx'},bundle:true,platform:'node',format:'cjs',outfile:output.pathname,logLevel:'silent'});
const {riffMeasure,neck}=createRequire(import.meta.url)(output.pathname);
test.after(()=>rm(output,{force:true}));
const source={pitch:64,string:2,fret:5,label:'E',beat:0,duration:.5};
test('tab explains connected guitar techniques and simultaneous notes',()=>{
 for(const type of ['hammer','pull','slide']){
  const note={...source,pitch:66,fret:7,beat:.5,articulation:{type,fromPitch:64,fromString:2,fromFret:5}};
  const svg=riffMeasure([source,note],4);
  assert.match(svg,new RegExp(`data-articulation="${type}"`));
  assert.match(svg,type==='slide'?/Slide/:type==='hammer'?/Hammer-on/:/Pull-off/);
  assert.doesNotMatch(riffMeasure([{...note,tie:true}],4),/data-articulation/);
 }
 const note={...source,harmony:{pitch:60,string:3,fret:5,label:'C'}};
 assert.match(riffMeasure([note],4),/Double-stop/);
 const map=neck({dots:[],riff:[note],events:[]},5,null);
 assert.match(map,/data-solo-position="2-5"/);
 assert.match(map,/data-solo-position="3-5"/);
});
