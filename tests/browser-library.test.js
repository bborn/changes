import test from 'node:test';
import assert from 'node:assert/strict';
import {browserLibrary} from '../src/browser-library.js';
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};};
test('browser libraries persist valid songs locally and remain separate',async()=>{
 const device=storage(),a=browserLibrary(device),b=browserLibrary(storage());
 const song={slug:'custom-test',title:'Test',key:'C',tempo:100,style:'swing',timeSignature:'4/4',form:['A'],sections:{A:{bars:[['C']]}}};
 await a('songs',{method:'PUT',body:JSON.stringify(song)});
 await a('settings',{method:'PUT',body:'{"tempo":80}'});
 assert.equal((await browserLibrary(device)('library')).songs.length,1);
 assert.equal((await a('library')).settings.tempo,80);
 assert.equal((await b('library')).songs.length,0);
 await assert.rejects(a('songs',{method:'PUT',body:'{}'}));
 assert.equal((await a('library')).songs.length,1);
});
