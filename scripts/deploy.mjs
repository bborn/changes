import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const mode=process.argv[2];
if(!['public','personal'].includes(mode))throw Error('Choose public or personal.');
const prepareOnly=process.argv.includes('--prepare-only');
const local=JSON.parse(await readFile(path.join(root,'.local/deploy.json'),'utf8'));
const project=local[mode]?.project;
if(!project)throw Error(`Missing ${mode}.project in .local/deploy.json`);
const run=(command,args,options={})=>{const result=spawnSync(command,args,{cwd:root,stdio:'inherit',...options});if(result.status!==0)throw Error(`${command} failed (${result.status})`);};
run(process.execPath,['scripts/build.mjs',...(mode==='public'?['--public']:[])]);
const stage=path.join(root,'.deploy',mode);
await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});
await cp(path.join(root,'dist'),path.join(stage,'dist'),{recursive:true});
let config={name:project,compatibility_date:'2026-09-06'};
if(mode==='personal'){
 config=JSON.parse(await readFile(path.join(root,'wrangler.jsonc'),'utf8'));
 if(!config.d1_databases?.length||!config.vars?.PERSONAL_LIBRARY_ID)throw Error('Personal deployment requires existing D1 and library bindings.');
 await mkdir(path.join(stage,'data'),{recursive:true});
 await cp(path.join(root,'data/voicings.js'),path.join(stage,'data/voicings.js'));
 for(const name of ['functions','backend','src']) await cp(path.join(root,name),path.join(stage,name),{recursive:true});
}
config={...config,name:project,pages_build_output_dir:'./dist'};
await writeFile(path.join(stage,'wrangler.jsonc'),JSON.stringify(config,null,2));
if(mode==='public'){
 const catalog=JSON.parse(await readFile(path.join(stage,'dist/tunes/index.json'),'utf8'));
 if(catalog.length)throw Error('Public deployment must contain no song catalog.');
}
if(!prepareOnly)run(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'pages','deploy','dist','--cwd',stage,'--project-name',project,'--branch','main']);
console.log(`${mode} ${prepareOnly?'prepared':'deployed'}: ${project}`);
