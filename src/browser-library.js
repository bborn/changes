import {validateTune} from '../backend/validation.js';
const KEY='changes-browser-library-v1';
export function browserLibrary(storage=globalThis.localStorage){
 const read=()=>JSON.parse(storage.getItem(KEY)||'{"songs":[],"settings":{}}');
 return async (path,options={})=>{
  const library=read();
  if(path==='library'&&!options.method)return library;
  const value=JSON.parse(options.body);
  if(options.method!=='PUT')throw Error('Unsupported library operation');
  if(path==='songs'){
   const tune=validateTune(value);library.songs=[tune,...library.songs.filter(s=>s.slug!==tune.slug)];
   storage.setItem(KEY,JSON.stringify(library));return tune;
  }
  if(path==='settings'){library.settings=value;storage.setItem(KEY,JSON.stringify(library));return {saved:true};}
  throw Error('Unsupported library operation');
 };
}
