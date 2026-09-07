import {getVoicings} from './theory.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function miniShape(chord,selected){
 if(chord==='N.C.')return '<span class="mini-label"><small>No chord</small><b>Rest</b></span>';
 const shape=selected||getVoicings(chord)[0];if(!shape)return '';
 const frets=shape.frets.filter(f=>f!==null),start=Math.max(1,Math.min(...frets)),end=Math.max(start+3,...frets),count=end-start+1,gap=134/count;
 let svg=`<svg class="fretboard" viewBox="0 0 164 78" role="img" aria-label="${escape(chord)} chord shape, low E to high E frets ${shape.frets.map(f=>f??'muted').join(', ')}"><title>${escape(chord)} · fret ${start}</title>`;
 for(let f=0;f<=count;f++)svg+=`<line x1="${24+f*gap}" x2="${24+f*gap}" y1="10" y2="60" stroke="#cccbbf"/>`;
 for(let s=0;s<6;s++){const y=10+s*10;svg+=`<text x="1" y="${y+3}" font-size="9" fill="#667064">${['e','B','G','D','A','E'][s]}</text><line x1="24" x2="158" y1="${y}" y2="${y}" stroke="#a8a99e"/>`;const i=5-s,fret=shape.frets[i];if(fret===null)svg+=`<text x="14" y="${y+3}" font-size="10">×</text>`;else svg+=`<circle cx="${24+(fret-start+.5)*gap}" cy="${y}" r="4.2" fill="${shape.tones[i]==='R'?'#b84928':'#263d33'}"/>`;}
 for(let f=start;f<=end;f++)svg+=`<text x="${24+(f-start+.5)*gap}" y="75" text-anchor="middle" font-size="10" fill="#52604f">${f}</text>`;
 return `<span class="mini-label"><small>Chord shape</small><b>${escape(chord)}</b></span>${svg}</svg><span class="mini-more" aria-hidden="true">More shapes ›</span>`;
}
/** Compact horizontal neck, matching the full fretboard orientation. */
export function tinyShape(shape){
 if(!shape)return '<span class="tiny-rest">rest</span>';
 const frets=shape.frets.filter(f=>f!==null),start=Math.min(...frets),span=Math.max(4,Math.max(...frets)-start+1),step=64/span;
 let svg='<svg class="tiny-shape" viewBox="0 0 84 59" aria-hidden="true">';
 for(let f=0;f<=span;f++)svg+=`<line x1="${16+f*step}" x2="${16+f*step}" y1="6" y2="46" stroke="#b6baac" stroke-width=".7"/>`;
 for(let s=0;s<6;s++){const y=6+s*8,i=5-s;svg+=`<line x1="16" x2="80" y1="${y}" y2="${y}" stroke="#b6baac" stroke-width=".7"/>`;const f=shape.frets[i];if(f===null)svg+=`<text x="8" y="${y+3}" text-anchor="middle" font-size="9">×</text>`;else svg+=`<circle cx="${16+(f-start+.5)*step}" cy="${y}" r="3.1" fill="${shape.tones[i]==='R'?'#b84928':'#283b32'}"/>`;}
 for(let f=0;f<span;f++)svg+=`<text x="${16+(f+.5)*step}" y="57" text-anchor="middle" font-size="8" fill="currentColor">${start+f}</text>`;
 return svg+'</svg>';
}
