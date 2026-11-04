import { getConfig } from '../server/config.js';
import { getDb } from '../server/db.js';
import { UUID } from '../server/validation.js';
import { LeadStore } from '../server/store.js';
import { authorized, json, requireMethod } from '../server/http.js';
export default async function handler(req,res) {
  if (!requireMethod(req,res,'GET')) return;
  const config = getConfig();
  if (!authorized(req,config.adminToken)) return json(res,401,{error:'Unauthorized'});
  try {
    const url = new URL(req.url,'https://www.fleetpilot360.com');
    let before = null;
    if (url.searchParams.has('before')) {
      try {
        const raw = url.searchParams.get('before');
        if (raw.length > 256) throw new Error();
        before = JSON.parse(Buffer.from(raw,'base64url').toString());
        if (!Number.isFinite(Date.parse(before.at)) || !UUID.test(before.id)) throw new Error();
      } catch { return json(res,400,{error:'Invalid cursor'}); }
    }
    const store = new LeadStore(getDb());
    if (url.searchParams.get('view') === 'leads') {
      const leads = await store.list(before);
      return json(res,200,{leads,next_before:leads.length === 100 ? Buffer.from(JSON.stringify({at:leads.at(-1).created_at,id:leads.at(-1).id})).toString('base64url') : null,time_zone:'America/Chicago'});
    }
    return json(res,200,await store.summary());
  } catch { return json(res,503,{error:'Register unavailable'}); }
}
