import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const html = await readFile(new URL('../index.html',import.meta.url),'utf8');
const source = await readFile(new URL('../assets/quote-form.js',import.meta.url),'utf8');
const measurement = await readFile(new URL('../assets/measurement.js',import.meta.url),'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve,0));
async function setup({enabled=true,ads=true,responses=[]} = {}) {
  const dom = new JSDOM(html,{url:'https://www.fleetpilot360.com/?gclid=fixture&utm_source=google',runScripts:'outside-only'});
  const w=dom.window,calls=[];
  let challenge;
  w.turnstile={render:(_target,opts)=>{challenge=opts;return 'widget';},reset:()=>{}};
  w.fetch=async(url,options)=>{
    if(url==='/api/lead-config') return {ok:true,json:async()=>({enabled,siteKey:'fixture',ads:ads?{id:'AW-123456789',label:'fixture'}:null,consentVersion:'2026-11-04'})};
    calls.push({url,...options});
    const next=responses.shift();
    if(next instanceof Error) throw next;
    return {ok:next?.ok??true,json:async()=>next?.body??{status:'received',lead_id:'33bcae6e-8598-44fc-bffd-28470ce27b70'}};
  };
  w.eval(measurement);await tick();w.eval(source);await tick();
  if(enabled){w.fleetpilotTurnstileReady();challenge.callback('challenge-token');}
  const f=w.document.querySelector('#quote-form');
  for(const [key,value] of Object.entries({name:'Test',company:'QA Fleet',phone:'9565550100',message:'Test only'}))f.elements[key].value=value;
  const submit=async()=>{f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();};
  return {w,dom,f,calls,submit,challenge:()=>challenge.callback('new-token')};
}
test('success appears only after receipt and opted-out request never loads Google tag',async()=>{
  const s=await setup();try{
    await s.submit();assert.equal(s.calls.length,1);
    assert.equal(s.w.document.querySelector('.form-status').dataset.state,'success');
    assert.equal(s.w.document.querySelector('script[src*="googletagmanager"]'),null);
    assert.equal(s.w.dataLayer.filter(e=>e[0]==='event').length,0);
    const body=JSON.parse(s.calls[0].body);assert.deepEqual(body.attribution,{});assert.equal(body.measurementConsent,false);
    await s.submit();assert.equal(s.calls.length,1);
  }finally{s.dom.window.close();}
});
test('lost response retains details and retries with the same key',async()=>{
  const error=new Error('timeout');error.name='TimeoutError';
  const s=await setup({responses:[error]});try{
    await s.submit();assert.equal(s.f.elements.company.value,'QA Fleet');assert.equal(s.w.document.querySelector('.form-status').dataset.state,'error');
    s.challenge();await s.submit();assert.equal(s.calls[0].headers['Idempotency-Key'],s.calls[1].headers['Idempotency-Key']);
  }finally{s.dom.window.close();}
});
test('changed request after failure gets a new key and displays field errors',async()=>{
  const s=await setup({responses:[{ok:false,body:{error:'Check phone',fields:{phone:'Invalid phone'}}}]});try{
    await s.submit();assert.equal(s.f.elements.phone.getAttribute('aria-invalid'),'true');
    s.f.elements.phone.value='9565550101';s.challenge();await s.submit();
    assert.notEqual(s.calls[0].headers['Idempotency-Key'],s.calls[1].headers['Idempotency-Key']);
  }finally{s.dom.window.close();}
});
test('one conversion is emitted after accepted receipt, never for a rejected request',async()=>{
  const s=await setup({responses:[{ok:false,body:{error:'Try again'}}]});try{
    s.f.elements.measurementConsent.checked=true;s.f.elements.measurementConsent.dispatchEvent(new s.w.Event('change'));
    assert.ok(s.w.document.querySelector('script[src*="googletagmanager"]'));
    await s.submit();assert.equal(s.w.dataLayer.filter(e=>e[0]==='event').length,0);
    s.challenge();await s.submit();await s.submit();
    const events=s.w.dataLayer.filter(e=>e[0]==='event');assert.equal(events.length,1);
    assert.equal(events[0][2].transaction_id,'33bcae6e-8598-44fc-bffd-28470ce27b70');
    assert.equal(events[0][2].send_to,'AW-447615950/gSw_CNjmrrIdEM6nuNUB');
    s.f.elements.measurementConsent.checked=false;s.f.elements.measurementConsent.dispatchEvent(new s.w.Event('change'));
    assert.equal(s.w.dataLayer.at(-1)[2].ad_storage,'denied');
  }finally{s.dom.window.close();}
});
test('missing launch configuration disables submission with a working phone alternative',async()=>{
  const s=await setup({enabled:false});try{
    await s.submit();assert.equal(s.calls.length,0);assert.equal(s.f.querySelector('button').disabled,true);
    assert.match(s.w.document.querySelector('.form-status').textContent,/956-440-9800/);
  }finally{s.dom.window.close();}
});
test('measurement exception does not change accepted receipt into failure',async()=>{
 const s=await setup();try{
  s.f.elements.measurementConsent.checked=true;s.f.elements.measurementConsent.dispatchEvent(new s.w.Event('change'));
  s.w.fleetpilotMeasurement.conversion=()=>{throw Error('blocked tracker');};
  await s.submit();assert.equal(s.w.document.querySelector('.form-status').dataset.state,'success');
  await s.submit();assert.equal(s.calls.length,1);
 }finally{s.dom.window.close();}
});
test('in-flight duplicate submit sends one request and revoked consent emits no conversion',async()=>{
 const s=await setup();try{
  s.w.fleetpilotMeasurement.choose(true);
  let resolve;const original=s.w.fetch;s.w.fetch=(url,opts)=>url==='/api/leads'?new Promise(r=>{resolve=()=>original(url,opts).then(r);}):original(url,opts);
  const event=()=>s.f.dispatchEvent(new s.w.Event('submit',{bubbles:true,cancelable:true}));
  event();event();s.w.fleetpilotMeasurement.choose(false);resolve();await tick();await tick();
  assert.equal(s.calls.length,1);assert.equal(s.w.document.querySelector('.form-status').dataset.state,'success');
  assert.equal(s.w.dataLayer.filter(e=>e[0]==='event').length,0);
 }finally{s.dom.window.close();}
});
