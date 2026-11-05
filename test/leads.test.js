import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { LeadStore } from '../server/store.js';
import { normalizeLead, keyedHash } from '../server/validation.js';
import { getConfig } from '../server/config.js';
import { createLeadHandler } from '../server/lead-handler.js';
import { deliverOne } from '../server/notifications.js';
import { verifyTurnstile, sendNotification } from '../server/providers.js';
import opsHandler from '../api/lead-ops.js';
import workerHandler from '../api/lead-notifications.js';
const config = { ready:true,origins:['https://www.fleetpilot360.com'],hostnames:['www.fleetpilot360.com'],
  hashSecret:'test-secret-for-fixtures-not-production',fromEmail:'leads@example.com',toEmail:'tony@sharp-abs.com',turnstileSecret:'fixture' };
const body = () => ({name:'Test Lead',company:'QA Fleet',phone:'956-555-0100',email:'qa@example.com',fleet:'25',
  interest:'GPS tracking',message:'TEST ONLY',measurementConsent:false,consentVersion:'2026-11-04',website:'',turnstileToken:'fixture'});
const response = () => ({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(data){this.body=data;return this;}});
const request = (data=body(),key=randomUUID()) => ({method:'POST',headers:{origin:config.origins[0],
  'content-type':'application/json','idempotency-key':key,'x-vercel-forwarded-for':'192.0.2.1'},body:data});
async function fixture() {
  const db = new PGlite();
  await db.exec(await readFile(new URL('../migrations/001_leads.sql',import.meta.url),'utf8'));
  const adapter = {query:(...args)=>db.query(...args),connect:async()=>({query:(...args)=>db.query(...args),release(){}})};
  return {db,store:new LeadStore(adapter)};
}

test('normalizes contact; refuses invalid phone, email, blank name and forged choices',()=>{
  assert.equal(normalizeLead(body()).phone,'+19565550100');
  assert.equal(normalizeLead({...body(),phone:'+52 868 123 4567'}).phone,'+528681234567');
  for (const edit of [{name:'  '},{phone:'not a phone'},{email:'bad'},{interest:'forged'},{message:'x'.repeat(3001)}])
    assert.throws(()=>normalizeLead({...body(),...edit}),e=>e.status===422);
});
test('does not store advertising identifiers without consent',()=>{
  const b = {...body(),attribution:{gclid:'click-fixture',utm_source:'google',secret:'no'}};
  assert.deepEqual(normalizeLead(b).attribution,{});
  assert.deepEqual(normalizeLead({...b,measurementConsent:true}).attribution,{utm_source:'google',gclid:'click-fixture'});
});
test('launch configuration fails closed and Ads remains off without real IDs',()=>{
  assert.equal(getConfig({LEADS_ENABLED:'true'}).ready,false);
  assert.equal(getConfig({ADS_ENABLED:'true',GOOGLE_ADS_ID:'placeholder',GOOGLE_ADS_LABEL:'label'}).ads,null);
});
test('real SQL stores one lead, one outbox record and one conversion record atomically',async()=>{
  const {db,store}=await fixture();
  try {
    const key=randomUUID(),lead=normalizeLead(body()),hash=keyedHash(JSON.stringify(lead),config.hashSecret);
    const a=await store.save(key,hash,lead,config),b=await store.save(key,hash,lead,config);
    assert.equal(a.id,b.id);assert.equal(a.created,true);assert.equal(b.created,false);
    for (const table of ['fp_leads','fp_notifications','fp_conversion_events'])
      assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,1);
    await assert.rejects(store.save(key,'different',lead,config),e=>e.status===409);
    assert.equal((await db.query('SELECT state FROM fp_conversion_events')).rows[0].state,'not_consented');
  } finally {await db.close();}
});
test('outbox failure rolls back the lead and conversion event',async()=>{
  const {db,store}=await fixture();
  try {
    await db.exec("ALTER TABLE fp_notifications ADD CONSTRAINT reject_test CHECK (state='impossible')");
    await assert.rejects(store.save(randomUUID(),'hash',normalizeLead(body()),config));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM fp_leads')).rows[0].n,0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM fp_conversion_events')).rows[0].n,0);
  } finally {await db.close();}
});
test('endpoint saves before success; expired challenge retry returns same ID',async()=>{
  const {db,store}=await fixture();let verifies=0;
  try {
    const handler=createLeadHandler({config,store,verify:async()=>{verifies++;return true;},deliver:async()=>{throw new Error('outage');}});
    const req=request(),res=response();await handler(req,res);
    assert.equal(res.code,201);assert.equal(res.body.status,'received');
    req.body.turnstileToken='expired';const retry=response();await handler(req,retry);
    assert.equal(retry.code,200);assert.equal(retry.body.lead_id,res.body.lead_id);assert.equal(verifies,1);
    assert.equal((await db.query('SELECT state FROM fp_notifications')).rows[0].state,'pending');
    req.body.company='changed';const conflict=response();await handler(req,conflict);assert.equal(conflict.code,409);
  } finally {await db.close();}
});
test('origin, spam, malformed JSON, oversized body and invalid challenge never create a lead',async()=>{
  const {db,store}=await fixture();
  try {
    const handler=createLeadHandler({config,store,verify:async()=>false});
    const cases = [
      [Object.assign(request(),{headers:{origin:'https://evil.example'}}),403],
      [request({...body(),website:'spam'}),422],
      [request('{broken'),400],
      [request({...body(),message:'x'.repeat(17000)}),413],
      [request(),422],
    ];
    for(const [req,code] of cases){const res=response();await handler(req,res);assert.equal(res.code,code);}
    assert.equal((await db.query('SELECT count(*)::int AS n FROM fp_leads')).rows[0].n,0);
  } finally {await db.close();}
});
test('database outage cannot return a successful receipt',async()=>{
  const handler=createLeadHandler({config,store:{allowRequest:async()=>{throw new Error('db down');}}});
  const res=response();await handler(request(),res);assert.equal(res.code,503);assert.equal(res.body.lead_id,undefined);
});
test('durable limiter rejects excess attempts',async()=>{
  const {db,store}=await fixture();try{
    assert.equal(await store.allowRequest('bucket',2),true);assert.equal(await store.allowRequest('bucket',2),true);
    assert.equal(await store.allowRequest('bucket',2),false);
    await db.query("UPDATE fp_rate_limits SET expires_at=now()-interval '1 second'");
    assert.equal(await store.allowRequest('bucket',2),true);
  }finally{await db.close();}
});
test('notification failure retries, succeeds once, and does not claim a sent job',async()=>{
  const {db,store}=await fixture();try{
    const lead=await store.save(randomUUID(),'hash',normalizeLead(body()),config);
    await deliverOne(store,config,lead.id,async()=>{throw new Error('email_http_503');});
    let row=(await db.query('SELECT * FROM fp_notifications')).rows[0];
    assert.equal(row.state,'pending');assert.equal(row.attempts,1);
    assert.equal(await deliverOne(store,config,lead.id,async()=>assert.fail()),false);
    await db.query('UPDATE fp_notifications SET available_at=now()');
    await deliverOne(store,config,lead.id,async()=> 'email-fixture');
    row=(await db.query('SELECT * FROM fp_notifications')).rows[0];assert.equal(row.state,'sent');assert.equal(row.provider_id,'email-fixture');
    assert.equal(await store.claimNotification(),null);
  }finally{await db.close();}
});
test('worker lease excludes a second claim; stale acknowledgments cannot overwrite a new lease',async()=>{
  const {db,store}=await fixture();try{
    await store.save(randomUUID(),'hash',normalizeLead(body()),config);
    const first=await store.claimNotification();assert.ok(first);assert.equal(await store.claimNotification(),null);
    await db.query("UPDATE fp_notifications SET locked_until=now()-interval '1 second'");
    const second=await store.claimNotification();assert.notEqual(first.lock_token,second.lock_token);
    await store.completeNotification(first,'stale');
    assert.equal((await db.query('SELECT state FROM fp_notifications')).rows[0].state,'processing');
    await store.completeNotification(second,'current');
    assert.equal((await db.query('SELECT provider_id FROM fp_notifications')).rows[0].provider_id,'current');
  }finally{await db.close();}
});
test('ambiguous retries stop before email provider deduplication expires',async()=>{
  const {db,store}=await fixture();try{
    await store.save(randomUUID(),'hash',normalizeLead(body()),config);
    await db.query("UPDATE fp_notifications SET first_attempt_at=now()-interval '24 hours'");
    assert.equal(await store.claimNotification(),null);
    assert.equal((await db.query('SELECT state FROM fp_notifications')).rows[0].state,'review');
  }finally{await db.close();}
});
test('Turnstile requires expected hostname and action, not merely success=true',async()=>{
  for (const result of [{success:true,hostname:'evil.example',action:'quote_request'},
    {success:true,hostname:config.hostnames[0],action:'login'},{success:false}])
    assert.equal(await verifyTurnstile('token',config,async()=>({ok:true,json:async()=>result})),false);
  assert.equal(await verifyTurnstile('token',config,async()=>({ok:true,json:async()=>({success:true,hostname:config.hostnames[0],action:'quote_request'})})),true);
});
test('notification uses stable provider deduplication key and fixed recipient',async()=>{
  await sendNotification({lead_id:'reference',payload:{to:['tony@sharp-abs.com']}},config,async(url,options)=>{
    assert.equal(url,'https://api.resend.com/emails');assert.equal(options.headers['Idempotency-Key'],'fleetpilot360/lead/reference');
    return {ok:true,json:async()=>({id:'provider-id'})};
  });
});
test('operations and worker endpoints refuse unauthenticated access',async()=>{
  for(const handler of [opsHandler,workerHandler]){const res=response();await handler({method:'GET',headers:{},url:'/api/lead-ops'},res);assert.equal(res.code,401);}
});
test('exhausted worker lease is flagged for review instead of silently stranded',async()=>{
  const {db,store}=await fixture();try{
    await store.save(randomUUID(),'hash',normalizeLead(body()),config);
    await db.query("UPDATE fp_notifications SET state='processing',attempts=8,locked_until=now()-interval '1 minute'");
    assert.equal(await store.claimNotification(),null);
    assert.equal((await db.query('SELECT state FROM fp_notifications')).rows[0].state,'review');
  }finally{await db.close();}
});
test('lead export cursor includes ID to preserve records with the same timestamp',async()=>{
  const {db,store}=await fixture();try{
    const a=await store.save(randomUUID(),'hash',normalizeLead(body()),config);
    const b=await store.save(randomUUID(),'hash',normalizeLead(body()),config);
    await db.query("UPDATE fp_leads SET created_at='2026-11-04T20:00:00.123456Z'");
    const all=await store.list(null);assert.equal(all.length,2);
    const next=await store.list({at:all[0].created_at,id:all[0].id});
    assert.equal(next.length,1);assert.equal(next[0].id,all[1].id);assert.notEqual(a.id,b.id);
  }finally{await db.close();}
});
