/* FleetPilot360 Google tag. Basic consent: no Google request before opt-in. */
(() => {
  if (window.fleetpilotMeasurement) return;
  const id = 'AW-447615950', label = 'gSw_CNjmrrIdEM6nuNUB';
  const key = 'fp-measurement-v1', lifetime = 180 * 86400000;
  let allowed = false, decided = false, started = false, script;
  const emitted = new Set();
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  const denied = {ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'};
  window.gtag('consent', 'default', denied);
  // Do not send remarketing or user-provided contact details.
  function state() { return {...denied, ad_storage:allowed?'granted':'denied', analytics_storage:allowed?'granted':'denied',ad_user_data:allowed?'granted':'denied'}; }
  function start() {
    if (!allowed) return;
    if (!started) {
      started = true;
      window.gtag('consent', 'update', state());
      window.gtag('js', new Date());
      window.gtag('config', id, {allow_ad_personalization_signals:false,allow_google_signals:false});
    }
    if (!script) {
      script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
      script.onerror = () => { script.remove(); script = null; };
      document.head.append(script);
    }
  }
  function sync() {
    document.querySelectorAll('[name="measurementConsent"]').forEach(el => { el.checked = allowed; });
    const panel = document.getElementById('measurement-choice');
    if (panel) panel.hidden = decided;
  }
  function choose(value) {
    allowed = value === true; decided = true;
    try { localStorage.setItem(key,JSON.stringify({allowed,expires:Date.now()+lifetime})); } catch {}
    if (started) window.gtag('consent','update',state());
    if (allowed) start();
    sync();
  }
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && typeof saved.allowed === 'boolean' && saved.expires > Date.now()) {
      allowed = saved.allowed; decided = true;
    }
  } catch {}
  window.fleetpilotMeasurement = {
    get allowed() { return allowed; }, choose,
    conversion(leadId) {
      if (!allowed || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(leadId) || emitted.has(leadId)) return false;
      start();
      // The server receipt UUID is also Google's deduplication key.
      emitted.add(leadId);
      window.gtag('event','conversion',{send_to:id+'/'+label,transaction_id:leadId,value:1.0,currency:'USD'});
      return true;
    }
  };
  if (allowed) start();
  function mount() {
    const panel = document.createElement('section');
    panel.id = 'measurement-choice'; panel.setAttribute('aria-label','Advertising measurement choices');
    panel.innerHTML = '<p>Allow cookies and share advertising identifiers and conversion activity with Google to measure which ads bring requests? No form contact details are shared. You can request pricing either way. <a href="/privacy">Privacy policy</a></p><div><button type="button" data-choice="yes">Allow measurement</button><button type="button" data-choice="no">No thanks</button></div>';
    panel.querySelector('[data-choice="yes"]').onclick = () => choose(true);
    panel.querySelector('[data-choice="no"]').onclick = () => choose(false);
    document.body.append(panel);
    const button = document.createElement('button'); button.type = 'button'; button.id = 'measurement-settings'; button.textContent = 'Privacy choices';
    button.onclick = () => { panel.hidden = false; panel.querySelector('button').focus(); };
    (document.querySelector('footer') || document.body).append(button);
    document.querySelectorAll('[name="measurementConsent"]').forEach(el => el.addEventListener('change',() => choose(el.checked)));
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    let saved; try { saved = JSON.parse(event.newValue); } catch {}
    allowed = saved?.allowed === true && saved.expires > Date.now(); decided = !!saved && saved.expires > Date.now();
    if (started) window.gtag('consent','update',state());
    if (allowed) start();
    sync();
  });
})();
