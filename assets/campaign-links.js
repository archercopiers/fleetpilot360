// Keep incoming campaign parameters on internal navigation without setting cookies.
const incoming = new URLSearchParams(location.search);
const campaignKeys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','gclid','gbraid','wbraid'];
if (campaignKeys.some(key => incoming.has(key))) {
  for (const link of document.querySelectorAll('a[href^="/"]')) {
    const destination = new URL(link.href);
    if (destination.origin !== location.origin) continue;
    for (const key of campaignKeys) {
      const value = incoming.get(key);
      if (value && value.length <= 256) destination.searchParams.set(key,value);
    }
    link.href = destination.href;
  }
}
