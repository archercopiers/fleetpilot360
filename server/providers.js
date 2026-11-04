export async function verifyTurnstile(token, config, fetcher = fetch) {
  if (typeof token !== 'string' || token.length < 1 || token.length > 2048) return false;
  const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: new URLSearchParams({ secret: config.turnstileSecret, response: token }),
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error('Verification unavailable');
  const result = await response.json();
  return result.success === true && config.hostnames.includes(result.hostname) && result.action === 'quote_request';
}
export function emailPayload(lead, id, config) {
  return {
    from: config.fromEmail, to: [config.toEmail],
    ...(lead.email ? { reply_to: lead.email } : {}),
    subject: `FleetPilot360 pricing request [${id}]`,
    text: [`Reference: ${id}`, `Name: ${lead.name}`, `Company: ${lead.company}`, `Phone: ${lead.phone}`,
      `Email: ${lead.email || 'Not provided'}`, `Fleet size: ${lead.fleet || 'Not provided'}`,
      `Interest: ${lead.interest}`, '', lead.message, '',
      'This request is stored in the FleetPilot360 lead register.'].join('\n'),
  };
}
export async function sendNotification(job, config, fetcher = fetch) {
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${config.resendKey}`, 'Content-Type': 'application/json',
      'Idempotency-Key': `fleetpilot360/lead/${job.lead_id}` },
    body: JSON.stringify(job.payload), signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`email_http_${response.status}`);
  const result = await response.json();
  if (typeof result.id !== 'string') throw new Error('email_invalid_response');
  return result.id;
}
