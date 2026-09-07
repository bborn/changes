import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { catalog } from './catalog.mjs';
import { bundle } from './bundle.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const publicDemo = process.argv.includes("--public");
const entries = publicDemo ? [] : await catalog(root);
await rm(new URL('../dist/',import.meta.url), {recursive:true,force:true});
await mkdir(new URL('../dist/',import.meta.url));
for (const name of ['index.html','credits.html','styles.css','data',...(!publicDemo?['tunes','_routes.json']:[]),'_headers']) await cp(new URL(`../${name}`,import.meta.url),new URL(`../dist/${name}`,import.meta.url),{recursive:true});
await mkdir(new URL('../dist/assets/',import.meta.url),{recursive:true});
await bundle({outfile:fileURLToPath(new URL('../dist/assets/app.js',import.meta.url))});
await mkdir(new URL('../dist/src/vendor/',import.meta.url),{recursive:true});
await cp(new URL('../node_modules/vexflow/build/cjs/vexflow.js',import.meta.url),new URL('../dist/src/vendor/vexflow.js',import.meta.url));
console.log(`Static site ready in dist/ with ${entries.length} tunes.`);

await cp(new URL('../node_modules/vexflow/LICENSE',import.meta.url),new URL('../dist/src/vendor/VEXFLOW-LICENSE',import.meta.url));

await writeFile(new URL('../dist/app-config.json',import.meta.url),JSON.stringify({library:publicDemo?'browser':'server'}));
if(publicDemo){
 await mkdir(new URL('../dist/tunes/',import.meta.url),{recursive:true});
 await writeFile(new URL('../dist/tunes/index.json',import.meta.url),'[]');
 await rm(new URL('../dist/data/melody-sources.json',import.meta.url),{force:true});
}
