import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSong,serializeSong,readSongs,saveSong,importSong,SONGS_STORAGE_KEY} from '../src/songs.js';
const fields = {title:'My song',key:'Bb minor',tempo:120,style:'swing',form:'A, B A',chart:'A:\nCm7 | F7\nB: Bbmaj7 Ebmaj7 | Am7b5 D7'};
const storage = () => {const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};

test('editor song roundtrips with split bars, section order and unicode notes',()=>{
 const song=parseSong({...fields,chart:fields.chart.replace('Bbmaj7','B♭maj7')},'custom-example');
 assert.equal(song.key,'Bbm');assert.deepEqual(song.form,['A','B','A']);assert.deepEqual(song.sections.B.bars,[['Bbmaj7','Ebmaj7'],['Am7b5','D7']]);
 assert.deepEqual(parseSong(serializeSong(song),song.slug),song);
 assert.deepEqual(parseSong({...fields,form:''}).form,['A','B']);
 assert.equal(parseSong({...fields,chart:'A: | C7 | G7 |\nB: Dm7 G7 Cmaj7 A7'}).sections.B.bars[0].length,4);
});
test('chart errors identify exact section/bar and reject empty or duplicate sections',()=>{
 assert.throws(()=>parseSong({...fields,chart:'A: Cm7 | Nope\nB: F7'}),/Section A, bar 2: unsupported chord/);
 assert.throws(()=>parseSong({...fields,form:'A Z'}),/unknown section “Z”/);
 assert.throws(()=>parseSong({...fields,chart:'A: Cm7 | | F7'}),/bar 2: empty/);
 assert.throws(()=>parseSong({...fields,chart:'A: Cm7\nA: F7'}),/declared more than once/);
 assert.throws(()=>parseSong({...fields,chart:'A:\nB: F7'}),/Section A must contain/);
 assert.throws(()=>parseSong({...fields,chart:'A: C D E'}),/1, 2, or 4/);
});
test('field validation and bounds reject invalid editor input',()=>{
 for(const patch of [{title:''},{title:'x'.repeat(101)},{key:'H'},{tempo:0},{tempo:241},{tempo:true},{style:'polka'},{chart:'Cmaj7'}]) assert.throws(()=>parseSong({...fields,...patch}));
 assert.throws(()=>parseSong({...fields,form:'A',chart:'A: '+Array(513).fill('C7').join(' | ')}),/512/);
 assert.throws(()=>parseSong(fields,'autumn-leaves'),/custom-/);
});
test('save persists validated custom songs and replaces an existing custom ID',()=>{
 const store=storage(),song=parseSong(fields,'custom-existing');
 assert.deepEqual(saveSong(song,store),song);assert.deepEqual(readSongs(store),[song]);
 saveSong({...song,title:'Updated'},store);assert.equal(readSongs(store).length,1);assert.equal(readSongs(store)[0].title,'Updated');
 assert.throws(()=>saveSong({...song,slug:'autumn-leaves'},store),/built-in/);
 assert.throws(()=>saveSong({...song,custom:false},store),/built-in/);
});
test('corrupt stored entries cannot crash loading or overwrite built-in IDs',()=>{
 const store=storage();store.setItem(SONGS_STORAGE_KEY,'{bad');assert.deepEqual(readSongs(store),[]);
 const song=parseSong(fields,'custom-good');store.setItem(SONGS_STORAGE_KEY,JSON.stringify([null,{},song,{...song,slug:'autumn-leaves'}]));
 assert.deepEqual(readSongs(store),[song]);
 assert.deepEqual(readSongs({getItem(){throw new Error('disabled');}}),[]);
});
test('storage failures are explicit and imports always get a fresh custom ID',()=>{
 const song=parseSong(fields,'custom-existing');
 assert.throws(()=>saveSong(song,{getItem:()=>null,setItem(){throw new Error('quota');}}),/Could not save/);
 const store=storage();const imported=importSong({...song,slug:'autumn-leaves',custom:false},store);
 assert.match(imported.slug,/^custom-/);assert.notEqual(imported.slug,song.slug);assert.equal(imported.custom,true);assert.equal(readSongs(store).length,1);
 for(const field of ['title','key','tempo','style','timeSignature','form','sections']) {const bad={...song};delete bad[field];assert.throws(()=>importSong(bad,store),new RegExp(`missing ${field}`));}
 assert.throws(()=>importSong({...song,timeSignature:'3/4'},store),/4\/4/);
 assert.throws(()=>importSong({...song,sections:{A:{bars:[['Cmaj7 | D7']]}}},store),/chord symbols/);
});

test('import and reload preserve validated section scale hints',()=>{
 const store=storage(),song=parseSong(fields);
 song.sections.A.scaleHint={primary:'Bb major',alt:'G harmonic minor',notes:'Raise F on D7.'};
 const imported=importSong(song,store);
 assert.deepEqual(imported.sections.A.scaleHint,song.sections.A.scaleHint);
 assert.deepEqual(readSongs(store)[0].sections.A.scaleHint,song.sections.A.scaleHint);
 song.sections.A.scaleHint.primary='H imaginary';
 assert.throws(()=>importSong(song,store),/Section A: scaleHint contains an unsupported scale/);
 assert.equal(readSongs(store).length,1);
});
