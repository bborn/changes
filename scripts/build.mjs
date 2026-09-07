import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { catalog } from './catalog.mjs';
import { bundle } from './bundle.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const entries = await catalog(root);
await rm(new URL('../dist/',import.meta.url), {recursive:true,force:true});
await mkdir(new URL('../dist/',import.meta.url));
for (const name of ['index.html','credits.html','styles.css','data','tunes','_headers','_routes.json']) await cp(new URL(`../${name}`,import.meta.url),new URL(`../dist/${name}`,import.meta.url),{recursive:true});
await mkdir(new URL('../dist/assets/',import.meta.url),{recursive:true});
await bundle({outfile:fileURLToPath(new URL('../dist/assets/app.js',import.meta.url))});
await mkdir(new URL('../dist/src/vendor/',import.meta.url),{recursive:true});
await cp(new URL('../node_modules/vexflow/build/cjs/vexflow.js',import.meta.url),new URL('../dist/src/vendor/vexflow.js',import.meta.url));
console.log(`Static site ready in dist/ with ${entries.length} tunes.`);

await cp(new URL('../node_modules/vexflow/LICENSE',import.meta.url),new URL('../dist/src/vendor/VEXFLOW-LICENSE',import.meta.url));
