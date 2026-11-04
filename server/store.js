import { randomUUID } from 'node:crypto';
import { HttpError } from './http.js';
import { emailPayload } from './providers.js';
export class LeadStore {
  constructor(db) { this.db = db; }
  async allowRequest(bucket, limit = 30, seconds = 600) {
    const { rows } = await this.db.query(`INSERT INTO fp_rate_limits(bucket,hits,expires_at)
      VALUES($1,1,now()+$2::int*interval '1 second')
      ON CONFLICT(bucket) DO UPDATE SET
      hits=CASE WHEN fp_rate_limits.expires_at < now() THEN 1 ELSE fp_rate_limits.hits+1 END,
      expires_at=CASE WHEN fp_rate_limits.expires_at < now() THEN EXCLUDED.expires_at ELSE fp_rate_limits.expires_at END
      RETURNING hits`, [bucket,seconds]);
    return rows[0].hits <= limit;
  }
  async lookup(key, hash) {
    const { rows } = await this.db.query('SELECT id,payload_hash FROM fp_leads WHERE request_key=$1',[key]);
    if (!rows.length) return null;
    if (rows[0].payload_hash !== hash) throw new HttpError(409,'This request changed. Please start a new request.');
    return rows[0].id;
  }
  async save(key, hash, lead, config) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const id = randomUUID();
      const result = await client.query(`INSERT INTO fp_leads
        (id,request_key,payload_hash,name,company,phone,email,fleet,interest,message,attribution,measurement_consent,consent_version)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT(request_key) DO NOTHING RETURNING id`,
        [id,key,hash,lead.name,lead.company,lead.phone,lead.email,lead.fleet,lead.interest,lead.message,
          JSON.stringify(lead.attribution),lead.measurementConsent,lead.consentVersion]);
      if (!result.rows.length) {
        const { rows } = await client.query('SELECT id,payload_hash FROM fp_leads WHERE request_key=$1',[key]);
        if (rows[0].payload_hash !== hash) throw new HttpError(409,'This request changed. Please start a new request.');
        await client.query('COMMIT');
        return { id: rows[0].id, created: false };
      }
      await client.query('INSERT INTO fp_notifications(lead_id,payload) VALUES($1,$2)',
        [id,JSON.stringify(emailPayload(lead,id,config))]);
      await client.query('INSERT INTO fp_conversion_events(lead_id,state) VALUES($1,$2)',
        [id,lead.measurementConsent ? 'eligible' : 'not_consented']);
      await client.query('COMMIT');
      return { id, created: true };
    } catch (e) {
      await client.query('ROLLBACK'); throw e;
    } finally { client.release(); }
  }
  async claimNotification(id = null) {
    // Stop ambiguous retries before the provider's 24-hour deduplication window expires.
    await this.db.query(`UPDATE fp_notifications SET state='review',last_error='retry_window_expired'
      WHERE state IN ('pending','processing') AND (first_attempt_at < now()-interval '23 hours' OR attempts>=8)
      AND (locked_until IS NULL OR locked_until < now())`);
    const { rows } = await this.db.query(`UPDATE fp_notifications SET state='processing',
      lock_token=$2,locked_until=now()+interval '60 seconds',attempts=attempts+1,
      first_attempt_at=COALESCE(first_attempt_at,now())
      WHERE lead_id=(SELECT lead_id FROM fp_notifications
        WHERE ($1::uuid IS NULL OR lead_id=$1) AND available_at<=now()
          AND (state='pending' OR (state='processing' AND locked_until<now()))
          AND attempts<8
        ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING *`,[id,randomUUID()]);
    return rows[0] || null;
  }
  async completeNotification(job, providerId) {
    await this.db.query(`UPDATE fp_notifications SET state='sent',provider_id=$3,sent_at=now(),
      locked_until=NULL,lock_token=NULL,last_error=NULL WHERE lead_id=$1 AND lock_token=$2`,
      [job.lead_id,job.lock_token,providerId]);
  }
  async failNotification(job, code) {
    const delay = Math.min(3600,60 * 2 ** (job.attempts - 1));
    await this.db.query(`UPDATE fp_notifications SET state=$3,available_at=now()+$4::int*interval '1 second',
      locked_until=NULL,lock_token=NULL,last_error=$5 WHERE lead_id=$1 AND lock_token=$2`,
      [job.lead_id,job.lock_token,job.attempts >= 8 ? 'review' : 'pending',delay,code]);
  }
  async cleanup() { await this.db.query('DELETE FROM fp_rate_limits WHERE expires_at<now()'); }
  async summary() {
    const { rows } = await this.db.query(`SELECT state,count(*)::int AS count FROM fp_notifications GROUP BY state`);
    const age = await this.db.query(`SELECT count(*)::int AS overdue FROM fp_notifications
      WHERE state!='sent' AND available_at<now()-interval '15 minutes'`);
    return { notifications: rows, overdue: age.rows[0].overdue };
  }
  async list(before) {
    const { rows } = await this.db.query(`SELECT l.id,l.name,l.company,l.phone,l.email,l.fleet,l.interest,l.message,
      l.attribution,l.measurement_consent,l.consent_version,l.status,l.created_at::text AS created_at,
      n.state AS notification_state,n.provider_id,n.attempts,n.last_error,n.sent_at,
      c.state AS conversion_state
      FROM fp_leads l JOIN fp_notifications n ON n.lead_id=l.id JOIN fp_conversion_events c ON c.lead_id=l.id
      WHERE ($1::timestamptz IS NULL OR (l.created_at,l.id)<($1::timestamptz,$2::uuid))
      ORDER BY l.created_at DESC,l.id DESC LIMIT 100`,[before?.at || null,before?.id || null]);
    return rows;
  }
}
