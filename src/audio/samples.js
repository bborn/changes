export const SAMPLE_NOTES={piano:{A2:45,C3:48,Ds3:51,Fs3:54,A3:57,C4:60,Ds4:63,Fs4:66,A4:69,C5:72,Ds5:75,Fs5:78},bass:{c2:36,eb2:39,a2:45,c3:48,eb3:51}};
export function nearestSample(samples,midi){return samples.reduce((best,item)=>!best||Math.abs(item.midi-midi)<Math.abs(best.midi-midi)?item:best,null);}
export async function loadSamples(context){
 const result={piano:[],bass:[]};
 await Promise.all(Object.entries(SAMPLE_NOTES).flatMap(([kind,notes])=>Object.entries(notes).map(async([name,midi])=>{
  const response=await fetch(`/data/samples/${kind==='bass'?'upright':kind}/${name}.mp3`,{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Instrument samples could not load. Please try again.');
  result[kind].push({midi,cents:kind==='bass'?({c2:25,eb2:33,c3:12}[name]||0):0,buffer:await context.decodeAudioData(await response.arrayBuffer())});
 })));
 return result;
}
