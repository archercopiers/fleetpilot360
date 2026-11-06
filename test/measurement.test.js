import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const source=await readFile(new URL('../assets/measurement.js',import.meta.url),'utf8');
const uuid='33bcae6e-8598-44fc-bffd-28470ce27b70';
const tick=()=>new Promise(r=>setTimeout(r,0));
async function setup(saved,blocked=false){
 const d=new JSDOM('<html><head></head><body><footer></footer><input name="measurementConsent" type="checkbox"></body></html>',{url:'https://www.fleetpilot360.com/solutions/gps-tracking',runScripts:'outside-only'});
 if(saved)d.window.localStorage.setItem('fp-measurement-v1',saved);
 if(blocked)Object.defineProperty(d.window,'localStorage',{get(){throw Error('blocked');}});
 d.window.eval(source);await tick();return d;
}
test('no Google script before consent; decline remains usable',async()=>{
 const d=await setup();try{const w=d.window;assert.equal(w.document.querySelector('script'),null);assert.equal(w.document.querySelector('#measurement-choice').hidden,false);w.fleetpilotMeasurement.choose(false);assert.equal(w.document.querySelector('script'),null);assert.equal(w.fleetpilotMeasurement.conversion(uuid),false);}finally{d.window.close();}
});
test('accept loads once, global gtag and correct ID; duplicate event suppressed; revoke blocks events',async()=>{
 const d=await setup();try{const w=d.window,m=w.fleetpilotMeasurement;m.choose(true);m.choose(true);assert.equal(w.document.querySelectorAll('script').length,1);assert.equal(typeof w.gtag,'function');const c=w.dataLayer.find(e=>e[0]==='config');assert.equal(c[1],'AW-447615950');assert.notEqual(c[2].send_page_view,false);assert.equal(m.conversion(uuid),true);assert.equal(m.conversion(uuid),false);assert.equal(m.conversion('bad'),false);m.choose(false);assert.equal(m.conversion('43bcae6e-8598-44fc-bffd-28470ce27b70'),false);}finally{d.window.close();}
});
test('remembered choice activates tag on another page; expired or malformed choices do not',async()=>{
 for(const [saved,active] of [[JSON.stringify({allowed:true,expires:Date.now()+100000}),true],[JSON.stringify({allowed:true,expires:1}),false],['broken',false]]){const d=await setup(saved);try{assert.equal(!!d.window.document.querySelector('script'),active);}finally{d.window.close();}}
});
test('storage unavailable does not break consent or conversion',async()=>{
 const d=await setup(null,true);try{d.window.fleetpilotMeasurement.choose(true);assert.equal(d.window.fleetpilotMeasurement.conversion(uuid),true);}finally{d.window.close();}
});
test('failed tag download can retry without reconfiguring or losing queued event',async()=>{
 const d=await setup();try{const w=d.window;w.fleetpilotMeasurement.choose(true);w.document.querySelector('script').dispatchEvent(new w.Event('error'));assert.equal(w.document.querySelector('script'),null);w.fleetpilotMeasurement.conversion(uuid);assert.ok(w.document.querySelector('script'));assert.equal(w.dataLayer.filter(e=>e[0]==='config').length,1);assert.equal(w.dataLayer.filter(e=>e[0]==='event').length,1);}finally{d.window.close();}
});
test('cross-tab revocation updates checkbox and stops conversion',async()=>{
 const d=await setup();try{const w=d.window;w.fleetpilotMeasurement.choose(true);w.dispatchEvent(new w.StorageEvent('storage',{key:'fp-measurement-v1',newValue:JSON.stringify({allowed:false,expires:Date.now()+10000})}));assert.equal(w.document.querySelector('input').checked,false);assert.equal(w.fleetpilotMeasurement.conversion(uuid),false);}finally{d.window.close();}
});
