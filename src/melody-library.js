/** Link private melody editions to existing charts without duplicate search rows. */
export function mergeMelodyLibrary(catalog,songs){
 const entries=catalog.map(song=>({...song}));
 for(const song of songs){
  const entry={...song,hasMelody:Boolean(song.hasMelody||Object.values(song.sections||{}).some(s=>s.melody))};
  const original=entries.find(s=>s.slug===song.originalSlug);
  if(original&&entry.hasMelody){original.hasMelody=true;original.melodyVersion=entry.slug;}
  else delete entry.originalSlug;
  entries.push(entry);
 }
 return entries;
}
