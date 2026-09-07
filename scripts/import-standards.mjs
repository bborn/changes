import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {parseChord,getVoicings} from '../src/theory.js';

export const SOURCE_REVISION='5fe168fd55be5c84512abcfbc4e6f1b1f8f0092a';
const sourceRoot=`https://github.com/smashub/choco/blob/${SOURCE_REVISION}/partitions/ireal-pro/choco/playlists/jams/`;
const aliases={'':'','-':'m','^':'maj7','^7':'maj7','^9':'maj9','^13':'maj13','-7':'m7','-6':'m6','-9':'m9','-11':'m11','-^7':'mMaj7','-^9':'mMaj9','h':'m7b5','h7':'m7b5','h9':'m7b5add9','o':'dim','o7':'dim7','o^7':'dimMaj7','+':'aug','69':'6add9','-69':'m6add9','sus':'sus4','2':'sus2','7at':'alt','-b6':'mb6','-#5':'m#5','7susadd3':'7sus4add3'};
export function convertChord(value) {
  if(value==='N')return 'N.C.';
  const match=/^([A-G][b#]?)([^/]*)(?:\/([A-G][b#]?))?$/.exec(value);
  if(!match)throw Error(`Unsupported chord ${value}`);
  let quality=match[2];
  if(Object.hasOwn(aliases,quality))quality=aliases[quality];
  else {
    quality=quality.replace(/^\^7/,'maj7').replace(/^\^9/,'maj9').replace(/^-7/,'m7');
    if(quality.endsWith('sus'))quality=quality.slice(0,-3).replace(/^(7|9|13)/,'$1sus4');
  }
  const symbol=match[1]+quality+(match[3]?'/'+match[3]:'');
  parseChord(symbol);
  return symbol;
}
export function convertChart(record) {
  const {id,chart}=record;
  const annotations=chart.annotations;
  const meters=annotations.find(a=>a.namespace==='timesig')?.data||record.meters;
  if(!meters?.length||meters.some(x=>![2,4,8].includes(x.value.denominator)||x.value.numerator<1||x.value.numerator>12||x.value.numerator!==meters[0].value.numerator||x.value.denominator!==meters[0].value.denominator))throw Error('Unsupported or changing meter');
  const beatsPerBar=meters[0].value.numerator;
  if(chart.sandbox?.expanded===false)throw Error('Source repeats are not expanded');
  const events=annotations.find(a=>a.namespace==='chord_ireal'||a.namespace==='chord')?.data;
  if(!events?.length)throw Error('Missing chord events');
  const firstBar=Math.floor(events[0].time),count=Math.floor(events.at(-1).time)-firstBar+1;
  if(count<1||count>512)throw Error('Unsupported chart length');
  const segments=Array.from({length:count},()=>[]);
  for(const event of events){
    const bar=Math.floor(event.time)-firstBar,offset=(event.time-Math.floor(event.time))*10;
    if(!Number.isFinite(event.duration)||event.duration<=0||offset<0||offset>=beatsPerBar)throw Error('Invalid chord timing');
    const chord=convertChord(event.value);let remaining=event.duration,b=bar,start=offset;
    while(remaining>1e-6){if(!segments[b])throw Error('Out-of-range chord timing');const length=Math.min(remaining,beatsPerBar-start);segments[b].push({start,duration:length,chord});remaining-=length;start=0;b++;}
  }
  for(const bar of segments){let end=0;for(const event of bar){if(Math.abs(event.start-end)>1e-5)throw Error('Incomplete or overlapping chord timing');end+=event.duration;}if(Math.abs(end-beatsPerBar)>1e-5)throw Error('Incomplete chord timing');}
  const bars=segments.map(bar=>bar.map(event=>event.chord)),durations=segments.map(bar=>bar.map(event=>event.duration));
  const sections={},form=[];
  for(let start=0;start<bars.length;start+=8){const name=form.length<26?String.fromCharCode(65+form.length):'S'+(form.length+1);form.push(name);const group=bars.slice(start,start+8),lengths=durations.slice(start,start+8);sections[name]={label:`Bars ${start+1}–${Math.min(start+8,bars.length)}`,bars:group};if(lengths.some(ds=>ds.some(d=>Math.abs(d-beatsPerBar/ds.length)>1e-5)))sections[name].barDurations=lengths;}
  const key=annotations.find(a=>a.namespace==='key_mode')?.data?.[0]?.value?.replace(/-$/,'m');
  if(!/^[A-G][b#]?m?$/.test(key))throw Error('Unsupported key');
  const genre=chart.sandbox.genre||'';
  const style=/bossa|latin|samba|bolero/i.test(genre)?'bossa':/funk|rock|pop|even/i.test(genre)?'funk':/ballad/i.test(genre)?'ballad':'swing';
  const rawTempo=Number(chart.sandbox.tempo);
  const tempo=rawTempo>=40&&rawTempo<=240?rawTempo:/ballad/i.test(genre)?72:/up tempo/i.test(genre)?180:/medium up/i.test(genre)?150:/slow/i.test(genre)?100:120;
  const title=chart.file_metadata.title;
  const slug=title.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  return {slug,title,composer:chart.file_metadata.artist||'',key,tempo,style,timeSignature:`${beatsPerBar}/${meters[0].value.denominator}`,form,sections,sources:[record.source||sourceRoot+id+'.jams'],attribution:'ChoCo / iReal Pro community · CC BY 4.0',arrangementNotes:'Community chord changes from ChoCo. Source repeats are expanded; practice sections group eight bars. Chord symbols normalized without reducing harmony. Tempo defaults to a practice pace where the source has none.',sourceId:id};
}
export async function importStandards(){
  const records=JSON.parse(gunzipSync(await readFile(process.env.CHOCO_INPUT || new URL('./vendor/choco-playlists.json.gz',import.meta.url))));
  const directory=new URL('../tunes/',import.meta.url);await mkdir(directory,{recursive:true});
  const imported=[],skipped=[],seen=new Set();
  const voicingCache=new Map();
  for(const record of records){try{
    const tune=convertChart(record);
    if(seen.has(tune.slug)){skipped.push({id:record.id,title:tune.title,reason:'Duplicate or curated chart retained'});continue;}
    for(const section of Object.values(tune.sections))for(const chord of new Set(section.bars.flat())){
      if(!voicingCache.has(chord))voicingCache.set(chord,getVoicings(chord).length);
      if(chord!=='N.C.'&&voicingCache.get(chord)<2)throw Error(`No playable voicings for ${chord}`);
    }
    seen.add(tune.slug);await writeFile(new URL(tune.slug+'.json',directory),JSON.stringify(tune)+'\n');imported.push({id:record.id,slug:tune.slug});
  }catch(error){skipped.push({id:record.id,title:record.chart.file_metadata.title,reason:error.message});}}
  await mkdir(new URL('./vendor/',import.meta.url),{recursive:true});
  const report={sourceRevision:SOURCE_REVISION,sourceCount:records.length,importedCount:imported.length,imported,skipped};
  await writeFile(new URL('./vendor/import-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({imported:imported.length,skipped:skipped.length,reasons:skipped.reduce((out,row)=>(out[row.reason]=(out[row.reason]||0)+1,out),{})},null,2));
}
if(process.argv[1]===fileURLToPath(import.meta.url))await importStandards();
