import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist');
for (const path of ['index.html','privacy.html','terms.html','favicon.ico','assets']) await cp(path,`dist/${path}`,{recursive:true});
console.log('Static public files prepared; server files and secrets excluded.');
