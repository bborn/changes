// Import user-supplied Changes JSON into the ignored local catalog.
import {readFile,writeFile,access} from 'node:fs/promises';
import {validateTune} from '../backend/validation.js';
import {catalog} from './catalog.mjs';
import {fileURLToPath} from 'node:url';
const input=process.argv[2];
if(!input)throw Error('Usage: npm run import:tunes -- /path/to/songs.json');
const data=JSON.parse(await readFile(input,'utf8'));
const songs=Array.isArray(data)?data:[data];
const seen=new Set();
for(const song of songs){
 if(!/^[a-z0-9-]+$/.test(song.slug)||seen.has(song.slug))throw Error('Invalid or duplicate slug');
 validateTune({...song,slug:song.slug.startsWith('custom-')?song.slug:'custom-'+song.slug});seen.add(song.slug);
 try{await access(new URL('../tunes/'+song.slug+'.json',import.meta.url));throw Error('Existing tune would be overwritten: '+song.slug);}catch(error){if(error.code!=='ENOENT')throw error;}
}
for(const song of songs)await writeFile(new URL('../tunes/'+song.slug+'.json',import.meta.url),JSON.stringify(song,null,2)+'\n',{flag:'wx'});
await catalog(fileURLToPath(new URL('../',import.meta.url)));
console.log(`Imported ${songs.length} tunes into your local, gitignored catalog.`);
