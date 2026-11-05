export const CONSENT_VERSION = '2026-11-04';
export function getConfig(env = process.env) {
  const origins = (env.LEAD_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const validOrigins = origins.length > 0 && origins.every(s => {
    try { const u = new URL(s); return u.protocol === 'https:' && u.origin === s; } catch { return false; }
  });
  const required = ['DATABASE_URL','LEAD_HASH_SECRET','TURNSTILE_SECRET_KEY','TURNSTILE_SITE_KEY',
    'RESEND_API_KEY','LEAD_FROM_EMAIL','LEAD_ADMIN_TOKEN','CRON_SECRET'];
  const ready = env.LEADS_ENABLED === 'true' && validOrigins && required.every(k => env[k]) &&
    ['LEAD_HASH_SECRET','LEAD_ADMIN_TOKEN','CRON_SECRET'].every(k => env[k]?.length >= 32) &&
    !/[\r\n]/.test(env.LEAD_FROM_EMAIL || '');
  const adsEnabled = env.ADS_ENABLED === 'true' && /^AW-\d+$/.test(env.GOOGLE_ADS_ID || '') &&
    /^[\w-]+$/.test(env.GOOGLE_ADS_LABEL || '');
  return {
    ready, origins, hostnames: origins.map(s => { try { return new URL(s).hostname; } catch { return ''; } }),
    hashSecret: env.LEAD_HASH_SECRET, turnstileSecret: env.TURNSTILE_SECRET_KEY,
    siteKey: env.TURNSTILE_SITE_KEY, resendKey: env.RESEND_API_KEY,
    fromEmail: env.LEAD_FROM_EMAIL, toEmail: 'tony@sharp-abs.com',
    adminToken: env.LEAD_ADMIN_TOKEN, cronSecret: env.CRON_SECRET,
    ads: adsEnabled ? { id: env.GOOGLE_ADS_ID, label: env.GOOGLE_ADS_LABEL } : null,
  };
}
