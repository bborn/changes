import fs from 'node:fs';
import {validateTune} from '../backend/validation.js';
const input=JSON.parse(fs.readFileSync('/tmp/changes-openewld/converted.json')),accepted=[],skipped=[];
for(const tune of input){try{validateTune({...tune,slug:'custom-'+tune.slug});fs.writeFileSync('tunes/'+tune.slug+'.json',JSON.stringify(tune,null,2)+'\n');const path='tunes/'+tune.originalSlug+'.json',original=JSON.parse(fs.readFileSync(path));original.melodyVersion=tune.slug;fs.writeFileSync(path,JSON.stringify(original,null,2)+'\n');accepted.push({title:tune.title,slug:tune.slug,bars:Object.values(tune.sections).reduce((n,s)=>n+s.bars.length,0),source:tune.melodySource});}catch(error){skipped.push({title:tune.title,error:error.message});}}
fs.writeFileSync('data/melody-sources.json',JSON.stringify({collection:'OpenEWLD',imported:accepted,skipped},null,2)+'\n');console.log(JSON.stringify({accepted:accepted.length,skipped},null,2));
