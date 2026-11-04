import { createHmac } from 'node:crypto';
import { HttpError } from './http.js';
import { CONSENT_VERSION } from './config.js';
export const INTERESTS = ['GPS tracking','AI dash cams','ELD compliance','Complete fleet platform','Not sure yet'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function keyedHash(value, secret) { return createHmac('sha256', secret).update(value).digest('hex'); }
export function normalizeLead(body) {
  const errors = {};
  const field = (key, max, required = false, multiline = false) => {
    const v = body[key] ?? '';
    if (typeof v !== 'string') { errors[key] = 'Enter text.'; return ''; }
    const s = v.trim();
    if ((required && !s) || s.length > max || (multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/ : /[\x00-\x1f\x7f]/).test(s))
      errors[key] = required && !s ? 'This field is required.' : `Enter at most ${max} valid characters.`;
    return s;
  };
  const name = field('name',100,true), company = field('company',160,true);
  let phone = field('phone',40,true);
  if (!/^[+\d().\s-]+$/.test(phone)) errors.phone = 'Enter a valid phone number.';
  const digits = phone.replace(/\D/g,'');
  if (digits.length === 10 && !phone.startsWith('+')) phone = '+1' + digits;
  else if (digits.length === 11 && digits.startsWith('1') && !phone.startsWith('+')) phone = '+' + digits;
  else if (phone.startsWith('+') && /^[1-9]\d{7,14}$/.test(digits)) phone = '+' + digits;
  else errors.phone = 'Enter a 10-digit US phone number or include your country code.';
  const email = field('email',254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
  const fleet = field('fleet',80), interest = field('interest',50,true), message = field('message',3000,false,true);
  if (!INTERESTS.includes(interest)) errors.interest = 'Select one of the listed solutions.';
  if (body.measurementConsent !== true && body.measurementConsent !== false) errors.measurementConsent = 'Select a valid preference.';
  if (body.consentVersion !== CONSENT_VERSION) errors.consentVersion = 'Refresh the page and try again.';
  const attribution = {};
  if (body.measurementConsent === true && body.attribution && typeof body.attribution === 'object') {
    for (const k of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','gbraid','wbraid']) {
      const v = body.attribution[k];
      if (typeof v === 'string' && v.length <= 256 && !/[\x00-\x1f\x7f]/.test(v)) attribution[k] = v;
    }
  }
  if (Object.keys(errors).length) throw new HttpError(422, 'Please check the highlighted fields.', errors);
  return { name, company, phone, email, fleet, interest, message, attribution,
    measurementConsent: body.measurementConsent, consentVersion: CONSENT_VERSION };
}
