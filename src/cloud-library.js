import {browserLibrary} from './browser-library.js';
let localRequest;
let ready=false,settingsTimer;
export async function cloudRequest(path,options={}){
 if(localRequest)return localRequest(path,options);
 const headers=new Headers(options.headers);if(options.body&&!(options.body instanceof FormData))headers.set('Content-Type','application/json');
 const response=await fetch('/api/'+path,{...options,headers});const data=await response.json().catch(()=>({error:'Cloud library is unavailable.'}));if(!response.ok)throw Error(data.error||'Cloud request failed.');return data;
}
export async function connectCloud(){
 // One server-side collection on every device. No provisioning or device libraries.
 const config=await fetch('/app-config.json').then(r=>r.ok?r.json():{}).catch(()=>({}));
 if(config.library==='browser')localRequest=browserLibrary();
 const data=await cloudRequest('library');
 ready=true;return data;
}
export const cloudSongs=async()=>(await cloudRequest('library')).songs;
export const saveCloudSong=tune=>cloudRequest('songs',{method:'PUT',body:JSON.stringify(tune)});
export function saveCloudSettings(settings){if(!ready)return;clearTimeout(settingsTimer);settingsTimer=setTimeout(()=>cloudRequest('settings',{method:'PUT',body:JSON.stringify(settings)}).catch(()=>document.dispatchEvent(new CustomEvent('cloud-error',{detail:'Settings could not sync. Export your songs to keep a backup.'}))),500);}
