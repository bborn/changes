import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
export async function catalog(root) {
  const directory = path.join(root, 'tunes');
  const entries = [];
  for (const file of (await readdir(directory)).filter(f => f.endsWith('.json') && f !== 'index.json')) {
    const tune = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
    if (!/^[a-z0-9-]+$/.test(tune.slug) || file !== `${tune.slug}.json`) throw new Error(`Invalid slug or filename: ${file}`);
    if (!tune.title || !tune.key || !['swing','bossa','funk','ballad'].includes(tune.style) || !(tune.tempo >= 40 && tune.tempo <= 240) || !/^([1-9]|1[0-2])\/(2|4|8)$/.test(tune.timeSignature) || !Array.isArray(tune.form) || !tune.form.length) throw new Error(`Invalid tune metadata: ${file}`);
    for (const id of tune.form) {
      const section = tune.sections?.[id];
      if (!section || !Array.isArray(section.bars) || !section.bars.length || section.bars.some(bar => !Array.isArray(bar) || !(bar.length>=1&&bar.length<=12) || bar.some(chord => typeof chord !== 'string' || !chord.length))) throw new Error(`Invalid section ${id}: ${file}`);
    }
    for(const [id,section] of Object.entries(tune.sections)){if(section.barDurations){if(section.barDurations.length!==section.bars.length||section.barDurations.some((ds,i)=>ds.length!==section.bars[i].length||ds.some(d=>!Number.isFinite(d)||d<=0)||Math.abs(ds.reduce((a,b)=>a+b,0)-Number(tune.timeSignature.split('/')[0]))>1e-5))throw Error(`Invalid chord durations ${id}: ${file}`);}}
    const {slug,title,key,tempo,style,composer,melodyVersion,originalSlug} = tune;
    entries.push({slug,title,key,tempo,style,...(composer?{composer}: {}),hasMelody:Boolean(melodyVersion||Object.values(tune.sections).some(s=>s.melody)),...(melodyVersion?{melodyVersion}:{}),...(originalSlug?{originalSlug}:{})});
  }
  entries.sort((a,b) => a.title.localeCompare(b.title));
  await writeFile(path.join(directory,'index.json'), JSON.stringify(entries,null,2)+'\n');
  return entries;
}
