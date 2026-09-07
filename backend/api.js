import {validateTune} from './validation.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const problem=(message,status)=>{throw Object.assign(new Error(message),{status});};
async function body(request){if(Number(request.headers.get('content-length'))>1048576)problem('Request too large.',413);const text=await request.text();if(text.length>1048576)problem('Request too large.',413);try{return JSON.parse(text);}catch{problem('Invalid request.',400);}}
export async function api(request,env){
 try{
  const url=new URL(request.url),path=url.pathname.replace(/^\/api\/?/,'');
  if(path==='scans'||path.startsWith('scans/'))return json({error:'Scanning has been removed.'},410);
  if(!env.DB)problem('Cloud library is not configured yet.',503);
  if(request.method!=='GET'&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)problem('Invalid origin.',403);
  if(path==='health')return json({database:true,photos:false,scanner:false});
  const key=request.headers.get('authorization')?.replace(/^Bearer /,'');
  let library;
  if(env.PERSONAL_LIBRARY_ID){
   library=await env.DB.prepare('SELECT id,settings FROM libraries WHERE id=?').bind(env.PERSONAL_LIBRARY_ID).first();
  }else{
   if(!key||!/^[a-f0-9]{64}$/.test(key))problem('Connect your library first.',401);
   library=await env.DB.prepare('SELECT id,settings FROM libraries WHERE key_hash=? OR id IN (SELECT library_id FROM library_access_keys WHERE key_hash=?)').bind(await hash(key),await hash(key)).first();
  }
  if(!library)problem('Song database is unavailable.',503);
  if(path==='library'&&request.method==='GET'){
   const {results}=await env.DB.prepare('SELECT data FROM songs WHERE library_id=? ORDER BY updated_at DESC').bind(library.id).all();return json({songs:results.map(r=>JSON.parse(r.data)),settings:JSON.parse(library.settings)});
  }
  if(path==='settings'&&request.method==='PUT'){const data=await body(request);if(JSON.stringify(data).length>12000)problem('Settings too large.',400);await env.DB.prepare('UPDATE libraries SET settings=? WHERE id=?').bind(JSON.stringify(data),library.id).run();return json({saved:true});}
  if(path==='songs'&&request.method==='PUT'){
   const tune=validateTune(await body(request));if(tune.scanId&&!await env.DB.prepare('SELECT id FROM scans WHERE id=? AND library_id=?').bind(tune.scanId,library.id).first())problem('Scan not found.',404);
   await env.DB.prepare('INSERT INTO songs(library_id,slug,data) VALUES(?,?,?) ON CONFLICT(library_id,slug) DO UPDATE SET data=excluded.data,updated_at=CURRENT_TIMESTAMP').bind(library.id,tune.slug,JSON.stringify(tune)).run();if(tune.scanId)await env.DB.prepare('UPDATE scans SET status=?,draft=? WHERE id=? AND library_id=?').bind('saved',JSON.stringify(tune),tune.scanId,library.id).run();return json(tune);
  }
  return json({error:'Not found.'},404);
 }catch(error){return json({error:error.status?error.message:'Cloud library is unavailable. Please try again.'},error.status||500);}
}
