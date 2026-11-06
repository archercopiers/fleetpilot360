const form = document.getElementById('quote-form');
const status = form.querySelector('.form-status');
const button = form.querySelector('button[type=submit]');
const consent = form.elements.measurementConsent;
let config, widget, token = '', busy = false, finished = false;
let requestKey = crypto.randomUUID(), lastPayload = null;
function report(message, state = '') { status.textContent = message; status.dataset.state = state; }
function updateButton() { button.disabled = busy || finished || !config?.enabled || !token; }
function attribution() {
  if (!consent.checked) return {};
  const query = new URLSearchParams(location.search), result = {};
  for (const key of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','gbraid','wbraid']) {
    const value = query.get(key);
    if (value && value.length <= 256) result[key] = value;
  }
  return result;
}
function clearErrors() {
  form.querySelectorAll('.field-error').forEach(el => el.remove());
  form.querySelectorAll('[aria-invalid]').forEach(el => {el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');});
}
function showErrors(fields = {}) {
  for (const [name,message] of Object.entries(fields)) {
    const input = form.elements.namedItem(name);
    if (!input || !(input instanceof HTMLElement)) continue;
    input.setAttribute('aria-invalid','true');
    const error = document.createElement('span'); error.className = 'field-error'; error.id = `error-${name}`;
    error.textContent = message; input.setAttribute('aria-describedby',error.id); input.parentElement.append(error);
  }
  form.querySelector('[aria-invalid]')?.focus();
}
async function init() {
  try {
    const response = await fetch('/api/lead-config',{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error();
    config = await response.json();
    if (!config.enabled || !config.siteKey) throw new Error();
    window.fleetpilotTurnstileReady = () => {
      widget = window.turnstile.render('#quote-security', {
        sitekey:config.siteKey,action:'quote_request',
        callback: value => {token=value;updateButton(); if (!busy && !finished) report('Ready to receive your request.');},
        'expired-callback': () => {token='';updateButton();if (!finished) report('Please complete the security check again.');},
        'error-callback': () => {token='';updateButton();if (!finished) report('Security check unavailable. Please reload or call 956-440-9800.','error');},
      });
    };
    const script = document.createElement('script'); script.async = true; script.defer = true;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=fleetpilotTurnstileReady&render=explicit';
    script.onerror = () => report('Security check unavailable. Please reload or call 956-440-9800.','error');
    document.head.append(script);
    report('Please complete the security check.');
  } catch { report('Online requests are temporarily unavailable. Please call 956-440-9800.','error'); }
}
form.addEventListener('submit',async event => {
  event.preventDefault();
  if (busy || finished || !config?.enabled || !token || !form.reportValidity()) return;
  clearErrors();
  const values = new FormData(form);
  const payload = Object.fromEntries(['name','company','phone','email','fleet','interest','message','website'].map(k => [k,values.get(k)||'']));
  payload.measurementConsent = consent.checked; payload.consentVersion = config.consentVersion; payload.attribution = attribution();
  const serialized = JSON.stringify(payload);
  if (lastPayload !== null && lastPayload !== serialized) requestKey = crypto.randomUUID();
  lastPayload = serialized;
  busy = true; form.setAttribute('aria-busy','true'); updateButton(); report('Sending your request…');
  // Keep the exact submitted data stable while waiting; inputs remain intact on errors.
  const controls = Array.from(form.querySelectorAll('input,textarea,select'));
  controls.forEach(el => el.disabled = true);
  try {
    const response = await fetch('/api/leads',{
      method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':requestKey},
      body:JSON.stringify({...payload,turnstileToken:token}),signal:AbortSignal.timeout(25000),
    });
    const result = await response.json();
    if (!response.ok || result.status !== 'received' || !/^[0-9a-f-]{36}$/i.test(result.lead_id || '')) {
      showErrors(result.fields); throw new Error(result.error || 'We could not confirm your request. Please try again.');
    }
    finished = true;
    report(`Request received. Thank you! Our team will follow up.\nYour reference: ${result.lead_id}`,'success');
    button.textContent = 'Request received ✓';
    status.focus();
    // Measurement failure must never turn an accepted lead into a form error.
    if (payload.measurementConsent) {
      try { window.fleetpilotMeasurement?.conversion(result.lead_id); } catch {}
    }
  } catch (error) {
    const message = error.name === 'TimeoutError' || error.name === 'TypeError'
      ? 'We could not confirm your request. Your details are still here. Please retry; we will reuse your request reference, or call 956-440-9800.'
      : error.message;
    report(message,'error');
  } finally {
    busy = false; form.removeAttribute('aria-busy');
    controls.forEach(el => el.disabled = finished && el !== consent);
    token=''; if (widget !== undefined && !finished) window.turnstile.reset(widget);
    updateButton();
    form.querySelector('[aria-invalid]')?.focus();
  }
});
init();
