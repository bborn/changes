import test from 'node:test';
import assert from 'node:assert/strict';
import {followMelody} from '../src/melody-scroll.js';
test('melody wraps forward then rebases to identical middle chorus',()=>{
 const calls=[];let finish;
 globalThis.innerHeight=800;globalThis.matchMedia=()=>({matches:false});
 globalThis.window={scrollBy:options=>calls.push(options),addEventListener:(_,fn)=>{finish=fn;},removeEventListener:()=>{}};
 const cycles=[0,1,2].map(c=>({getBoundingClientRect:()=>({top:c*1000}),querySelectorAll:()=>[0,1].map(i=>({dataset:{bar:`0-${i}`},getBoundingClientRect:()=>({top:c*1000+i*300,bottom:c*1000+i*300+280})}))}));
 const chart={dataset:{followKey:'0-1',cycle:'1'},isConnected:true,querySelectorAll:()=>cycles};
 const root={querySelector:selector=>selector==='.melody-chart'?chart:null};
 followMelody(root,'0-0',{playing:true});
 assert.equal(chart.dataset.cycle,'2');assert.equal(calls[0].behavior,'smooth');assert.ok(calls[0].top>0);
 finish();assert.equal(chart.dataset.cycle,'1');assert.deepEqual(calls[1],{top:-1000,behavior:'instant'});
 followMelody(root,'0-0',{playing:true});assert.equal(calls.length,2);
});
