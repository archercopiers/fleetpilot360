import { sendNotification } from './providers.js';
export async function deliverOne(store, config, id = null, sender = sendNotification) {
  const job = await store.claimNotification(id);
  if (!job) return false;
  try {
    const providerId = await sender(job, config);
    await store.completeNotification(job,providerId);
  } catch (e) {
    // Never persist provider response bodies, credentials, contact details or stack traces.
    const code = /^email_http_\d{3}$/.test(e.message) ? e.message : 'email_delivery_unconfirmed';
    await store.failNotification(job,code);
  }
  return true;
}
