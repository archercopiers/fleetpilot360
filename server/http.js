import { timingSafeEqual } from 'node:crypto';
export class HttpError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields; }
}
export function json(res, status, data) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(data);
}
export function authorized(req, token) {
  const value = req.headers.authorization;
  if (!token || token.length < 32 || typeof value !== 'string') return false;
  const expected = Buffer.from(`Bearer ${token}`), actual = Buffer.from(value);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function requireMethod(req, res, method) {
  if (req.method === method) return true;
  res.setHeader('Allow', method); json(res, 405, { error: 'Method not allowed.' }); return false;
}
export function parseBody(req) {
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json'))
    throw new HttpError(415, 'Please send JSON.');
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? null);
  if (Buffer.byteLength(raw) > 16384) throw new HttpError(413, 'Request is too large.');
  let body;
  try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'Invalid request.'); }
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new HttpError(400, 'Invalid request.');
  return body;
}
