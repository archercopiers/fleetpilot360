import { trackerProducts } from './tracker-products.mjs';
import { buildSearchPages, homeSearchHead } from './search-pages.mjs';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist');
for (const path of ['index.html','privacy.html','terms.html','favicon.ico','google79e4b4633fb53468.html','assets']) await cp(path,`dist/${path}`,{recursive:true});
console.log('Static public files prepared; server files and secrets excluded.');

await buildSearchPages();
const home = await readFile('dist/index.html','utf8');
await writeFile('dist/index.html',home.replace('<!-- tracker-products -->', trackerProducts).replace('</head>',homeSearchHead+'</head>'));

// Install the same consent-aware Google tag in every generated public page.
// Inline initialization makes the tag ID visible in HTML and runs before form modules.
const measurement = await readFile('assets/measurement.js','utf8');
async function installMeasurement(dir) {
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await installMeasurement(path);
    else if (entry.name.endsWith('.html')) {
      const html = await readFile(path,'utf8');
      if (!html.includes('</head>')) continue; // Keep Google's verification file unchanged.
      await writeFile(path,html.replace('</head>',`<link rel="stylesheet" href="/assets/measurement.css"><script data-fleetpilot-measurement="v1">${measurement}</script></head>`));
    }
  }
}
await installMeasurement('dist');
