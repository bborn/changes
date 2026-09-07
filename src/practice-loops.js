import {parseSong} from './songs.js';
// Generic harmonic exercises, not transcriptions or arrangements of named songs.
export const PRACTICE_LOOPS = [
 {id:'major-251',title:'Major ii–V–I',key:'C',chart:'Dm7 | G7 | Cmaj7 | Cmaj7'},
 {id:'short-251',title:'Quick ii–V–I',key:'C',chart:'Dm7 G7 | Cmaj7 | Dm7 G7 | Cmaj7'},
 {id:'minor-251',title:'Minor ii–V–i',key:'Cm',chart:'Dm7b5 | G7b9 | Cm6 | Cm6'},
 {id:'major-turnaround',title:'Major turnaround · I–VI–ii–V',key:'C',chart:'Cmaj7 | A7 | Dm7 | G7'},
 {id:'minor-turnaround',title:'Minor turnaround · i–VI–ii–V',key:'Cm',chart:'Cm7 | Ab7 | Dm7b5 | G7b9'},
 {id:'blues',title:'12-bar blues',key:'F',chart:'F7 | Bb7 | F7 | F7 | Bb7 | Bb7 | F7 | F7 | C7 | Bb7 | F7 | C7'},
 {id:'jazz-blues',title:'Jazz blues',key:'F',chart:'F7 | Bb7 | F7 | Cm7 F7 | Bb7 | Bdim7 | F7 | D7 | Gm7 | C7 | F7 D7 | Gm7 C7'},
 {id:'minor-blues',title:'Minor blues',key:'Cm',chart:'Cm7 | Cm7 | Cm7 | Cm7 | Fm7 | Fm7 | Cm7 | Cm7 | Ab7 | G7b9 | Cm7 | G7b9'},
 {id:'rhythm-a',title:'Rhythm changes · A section',key:'Bb',chart:'Bb6 G7 | Cm7 F7 | Dm7 G7 | Cm7 F7 | Fm7 Bb7 | Ebmaj7 Edim7 | Bb6 G7 | Cm7 F7'},
 {id:'dominant-bridge',title:'Dominant-cycle bridge',key:'Bb',chart:'D7 | D7 | G7 | G7 | C7 | C7 | F7 | F7'},
 {id:'backdoor',title:'Backdoor resolution',key:'C',chart:'Dm7 | G7 | Cmaj7 | Cmaj7 | Fm7 | Bb7 | Cmaj7 | Cmaj7'},
 {id:'dorian-vamp',title:'Dorian vamp',key:'Dm',chart:'Dm7 | Dm7 | G7 | G7',style:'funk'},
 {id:'bossa-vamp',title:'Bossa major vamp',key:'C',chart:'Cmaj7 | Cmaj7 | Dm7 | G7',style:'bossa'},
 {id:'minor-line',title:'Minor descending line',key:'Am',chart:'Am | AmMaj7 | Am7 | Am6',style:'ballad',tempo:80},
];
export function createPracticeLoop(id){
 const loop=PRACTICE_LOOPS.find(item=>item.id===id);
 if(!loop)throw Error('Unknown practice loop');
 return parseSong({...loop,style:loop.style||'swing',tempo:loop.tempo||100,chart:'A: '+loop.chart},'custom-practice-'+id);
}
