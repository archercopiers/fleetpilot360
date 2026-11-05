BEGIN;
CREATE TABLE IF NOT EXISTS fp_leads (
  id uuid PRIMARY KEY,
  request_key uuid NOT NULL UNIQUE,
  payload_hash text NOT NULL,
  name text NOT NULL,
  company text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL DEFAULT '',
  fleet text NOT NULL DEFAULT '',
  interest text NOT NULL,
  message text NOT NULL DEFAULT '',
  attribution jsonb NOT NULL DEFAULT '{}',
  measurement_consent boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','closed','spam'))
);
CREATE TABLE IF NOT EXISTS fp_notifications (
  lead_id uuid PRIMARY KEY REFERENCES fp_leads(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processing','sent','review')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  lock_token uuid,
  first_attempt_at timestamptz,
  provider_id text,
  last_error text,
  sent_at timestamptz
);
CREATE TABLE IF NOT EXISTS fp_conversion_events (
  lead_id uuid PRIMARY KEY REFERENCES fp_leads(id) ON DELETE CASCADE,
  event_name text NOT NULL DEFAULT 'quote_request_received',
  created_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL CHECK (state IN ('eligible','not_consented'))
);
CREATE TABLE IF NOT EXISTS fp_rate_limits (
  bucket text PRIMARY KEY,
  hits integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS fp_leads_created_idx ON fp_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS fp_notifications_due_idx ON fp_notifications(state,available_at);
COMMIT;
