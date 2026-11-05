import { buildSearchPages, homeSearchHead } from './search-pages.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist');
for (const path of ['index.html','privacy.html','terms.html','favicon.ico','google79e4b4633fb53468.html','assets']) await cp(path,`dist/${path}`,{recursive:true});
console.log('Static public files prepared; server files and secrets excluded.');

await buildSearchPages();
const home = await readFile('dist/index.html','utf8');
await writeFile('dist/index.html',home.replace('</head>',homeSearchHead+'</head>'));
