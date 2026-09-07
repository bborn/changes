const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Shared horizontal guitar neck. String 6 is low E; string 1 is high E. */
export function renderFretboard({startFret=1,endFret=5,dots=[],muted=[],strings=6,compact=false,label='Guitar fretboard'}) {
  const count=endFret-startFret+1, width=compact?220:Math.max(380,count*49+65), left=38, top=28, gap=(width-left-16)/count;
  const height=60+(strings-1)*27;
  const x=fret=>left+(fret-startFret+.5)*gap, y=string=>top+(string-1)*27;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escape(label)}" viewBox="0 0 ${width} ${height}" class="fretboard"><title>${escape(label)}</title>`;
  for(let i=0;i<=count;i++) svg+=`<line x1="${left+i*gap}" y1="${top}" x2="${left+i*gap}" y2="${y(strings)}" stroke="#c8c6bb" stroke-width="${i===0&&startFret===1?4:1}"/>`;
  for(let s=1;s<=strings;s++) svg+=`<text x="13" y="${y(s)+4}" class="string-label">${['','e','B','G','D','A','E'][s]}</text><line x1="${left}" y1="${y(s)}" x2="${width-16}" y2="${y(s)}" stroke="#a8a99e" stroke-width="${.6+s*.16}"/>`;
  for(let f=startFret;f<=endFret;f++) svg+=`<text x="${x(f)}" y="${height-7}" text-anchor="middle" class="fret-number">${f}</text>${strings===6&&[3,5,7,9,12,15].includes(f)?`<circle cx="${x(f)}" cy="${top+67.5}" r="3" fill="#d2d2c5"/>`:''}`;
  for(const s of muted) svg+=`<text x="${left-12}" y="${y(s)+4}" text-anchor="middle" class="string-label">×</text>`;
  for(const d of dots) if(d.string<=strings&&d.fret>=startFret&&d.fret<=endFret) {const strong=d.emphasis===true||d.emphasis==='chord'||d.emphasis==='root', root=d.emphasis==='root';svg+=`<circle cx="${x(d.fret)}" cy="${y(d.string)}" r="${strong?11:9}" fill="${root?'#b84928':strong?'#263d33':'#e4e8d9'}" stroke="${strong?'none':'#a9b49e'}"/><text x="${x(d.fret)}" y="${y(d.string)+3.6}" text-anchor="middle" font-size="10" font-family="Arial,sans-serif" font-weight="600" fill="${strong?'#fff':'#314338'}">${escape(d.label??'')}</text>`;}
  return svg+'</svg>';
}
