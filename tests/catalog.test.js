import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { catalog } from '../scripts/catalog.mjs';
const tune = {slug:'new-tune',title:'New tune',key:'C',tempo:120,style:'swing',timeSignature:'4/4',form:['A'],sections:{A:{label:'A',bars:[['Cmaj7']]}}};
test('dropping a JSON tune discovers it without a manifest edit', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),'jazz-catalog-'));
  try {
    await mkdir(path.join(root,'tunes'));
    await writeFile(path.join(root,'tunes/new-tune.json'),JSON.stringify(tune));
    assert.deepEqual((await catalog(root)).map(t=>t.slug),['new-tune']);
    assert.equal(JSON.parse(await readFile(path.join(root,'tunes/index.json'),'utf8'))[0].title,'New tune');
    assert.equal((await catalog(root)).length,1);
  } finally {await rm(root,{recursive:true,force:true});}
});
test('malformed bars fail catalog generation with an actionable filename', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),'jazz-catalog-'));
  try {
    await mkdir(path.join(root,'tunes'));
    await writeFile(path.join(root,'tunes/new-tune.json'),JSON.stringify({...tune,sections:{A:{bars:[[]]}}}));
    await assert.rejects(catalog(root),/Invalid section A: new-tune.json/);
  } finally {await rm(root,{recursive:true,force:true});}
});
