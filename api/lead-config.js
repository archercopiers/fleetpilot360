import { getConfig, CONSENT_VERSION } from '../server/config.js';
import { json, requireMethod } from '../server/http.js';
export default function handler(req,res) {
  if (!requireMethod(req,res,'GET')) return;
  const config = getConfig();
  return json(res,200,{enabled:config.ready,siteKey:config.ready ? config.siteKey : null,
    ads:config.ready ? config.ads : null,consentVersion:CONSENT_VERSION});
}
