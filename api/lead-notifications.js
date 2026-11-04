import { getConfig } from '../server/config.js';
import { getDb } from '../server/db.js';
import { LeadStore } from '../server/store.js';
import { deliverOne } from '../server/notifications.js';
import { authorized, json, requireMethod } from '../server/http.js';
export default async function handler(req,res) {
  if (!requireMethod(req,res,'GET')) return;
  const config = getConfig();
  if (!authorized(req,config.cronSecret)) return json(res,401,{error:'Unauthorized'});
  if (!config.ready) return json(res,503,{error:'Not configured'});
  const store = new LeadStore(getDb());
  try {
    let processed = 0;
    // Bound each invocation; schedule at least every five minutes in production.
    while (processed < 5 && await deliverOne(store,config)) processed++;
    await store.cleanup();
    const summary = await store.summary();
    const unhealthy = summary.overdue > 0 || summary.notifications.some(n => n.state === 'review' && n.count > 0);
    if (unhealthy) console.error('lead_notification_backlog');
    return json(res,unhealthy ? 503 : 200,{processed,...summary});
  } catch { console.error('lead_notification_worker_failed'); return json(res,503,{error:'Worker unavailable'}); }
}
