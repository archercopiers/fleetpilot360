import { getConfig } from '../server/config.js';
import { getDb } from '../server/db.js';
import { LeadStore } from '../server/store.js';
import { createLeadHandler } from '../server/lead-handler.js';
import { json } from '../server/http.js';
export default async function handler(req,res) {
  const config = getConfig();
  if (!config.ready) return json(res,503,{error:'Online requests are temporarily unavailable. Please call 956-440-9800.'});
  return createLeadHandler({config,store:new LeadStore(getDb())})(req,res);
}
