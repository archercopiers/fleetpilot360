import { HttpError, json, parseBody, requireMethod } from './http.js';
import { normalizeLead, keyedHash, UUID } from './validation.js';
import { verifyTurnstile } from './providers.js';
import { deliverOne } from './notifications.js';
export function createLeadHandler({ config, store, verify = verifyTurnstile, deliver = deliverOne }) {
  return async (req,res) => {
    if (!requireMethod(req,res,'POST')) return;
    if (!config.ready) return json(res,503,{ error:'Online requests are temporarily unavailable. Please call 956-440-9800.' });
    try {
      if (!config.origins.includes(req.headers.origin)) throw new HttpError(403,'Request origin not allowed.');
      const body = parseBody(req);
      const key = req.headers['idempotency-key'];
      if (typeof key !== 'string' || !UUID.test(key)) throw new HttpError(400,'Invalid request reference.');
      // Vercel overwrites this header at its edge. Do not trust arbitrary x-forwarded-for values.
      const ip = String(req.headers['x-vercel-forwarded-for'] || 'unknown').split(',')[0].trim();
      const bucket = keyedHash(`ip:${ip}`,config.hashSecret);
      if (!await store.allowRequest(bucket)) throw new HttpError(429,'Too many attempts. Please wait 10 minutes or call 956-440-9800.');
      if (body.website) throw new HttpError(422,'Unable to accept this request. Please call 956-440-9800.');
      const lead = normalizeLead(body);
      const hash = keyedHash(JSON.stringify(lead),config.hashSecret);
      const existing = await store.lookup(key,hash);
      // A lost success response can be recovered even after the one-use challenge expires.
      if (existing) return json(res,200,{ status:'received',lead_id:existing });
      if (!await verify(body.turnstileToken,config)) throw new HttpError(422,'Please complete the security check again.',{ security:'Security check expired or was unsuccessful.' });
      const result = await store.save(key,hash,lead,config);
      // Persisted outbox is authoritative. Email failure cannot change a committed success.
      try { await deliver(store,config,result.id); } catch { console.error('lead_notification_pending'); }
      return json(res,result.created ? 201 : 200,{status:'received',lead_id:result.id});
    } catch (e) {
      if (e instanceof HttpError) {
        if (e.status === 429) res.setHeader('Retry-After','600');
        return json(res,e.status,{error:e.message,...(e.fields ? {fields:e.fields}: {})});
      }
      console.error('lead_request_unavailable');
      return json(res,503,{error:'We could not confirm your request. Your details are still here. Please retry or call 956-440-9800.'});
    }
  };
}
