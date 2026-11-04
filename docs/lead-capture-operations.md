# FleetPilot360 lead capture: release and operations

## Status

Implementation prepared for the existing Vercel project. Production activation is
blocked until dedicated storage, sender, Turnstile, retry scheduler, monitoring,
and an end-to-end inbox check are verified. Google Ads stays disabled until the
actual conversion action and account settings are inspected. Do not infer delivery
from a passing unit test or a successful email API response.

## Architecture

`POST /api/leads` checks the origin, JSON size, persistent rate limit, honeypot,
contact fields, and Turnstile. Accepted requests atomically insert the lead, a
notification outbox entry, and a consent-aware conversion ledger entry in PostgreSQL.
Only a successful commit permits a receipt. The immediate email attempt is bounded;
its failure leaves the committed receipt intact. A timed-out browser can resubmit
the same UUID and payload without revalidating an expired one-use challenge.

The recipient is fixed to `tony@sharp-abs.com`. No customer auto-email is sent.
Resend is the implemented email adapter; use an existing approved account and
verified sender, or replace this small adapter if another existing service is
selected. PostgreSQL can be a dedicated managed database accessible from Vercel;
no CoABS or DealerFlow database is used. No new paid service is authorized by this
implementation. Confirm plan/cost before provisioning a paid resource.

## Configuration and activation

1. Confirm this is the Vercel project connected to `archercopiers/fleetpilot360`
   and `www.fleetpilot360.com`. Preserve domain and access configuration.
2. Create/select a dedicated lead database, with backups and a restricted runtime
   role. Use a TLS-verified connection (e.g. provider-supported `sslmode=verify-full`).
   Preview must use a separate database. Configure variables privately in Vercel;
   use `.env.example` for names only. Never place values in GitHub, chat, or URLs.
3. Apply `migrations/001_leads.sql` to that database using a migration role:
   `CONFIRM_LEAD_DATABASE=fleetpilot360 npm run db:migrate`.
   This migration must NOT run in every request or during a public build.
   Runtime rights: CRUD on these four tables only; no schema/role administration.
4. Generate separate random 32-byte-or-longer values for `LEAD_HASH_SECRET`,
   `LEAD_ADMIN_TOKEN`, and `CRON_SECRET`; store them in the deployment secret store.
   Changing the hash secret invalidates previous idempotency hashes, so rotate
   with a migration/retention plan rather than casually changing it.
5. Configure Turnstile for the exact production and preview hostnames.
   Configure the site key and secret key; the server also verifies hostname and
   `action=quote_request`. Do not enable test keys in production. Do not wildcard
   all Vercel preview domains in the allowed origins.
6. Configure an existing Resend sending key and `LEAD_FROM_EMAIL` on a verified
   domain. Verify SPF/DKIM/domain readiness; use a restricted sending key.
7. Set `LEAD_ALLOWED_ORIGINS` to a comma-separated list of exact HTTPS origins
   (no trailing slash). Set `LEADS_ENABLED=true` only after dependencies exist.
   Initial deployment may keep it false while preview checks are performed.
8. Configure an authenticated scheduler at least every five minutes calling
   `GET /api/lead-notifications` with `Authorization: Bearer <CRON_SECRET>`.
   Vercel Cron can supply this header from the secret. Verify the actual plan
   allows this cadence BEFORE adding a cron to vercel.json. No cron is declared
   yet because the account plan has not been inspected. Do not use a public
   unauthenticated scheduler or put its secret in a URL.
9. Configure an independent alert for non-2xx worker responses, missed scheduler
   runs, and `lead_notification_backlog` / `lead_notification_worker_failed` logs.
   Logs intentionally contain no inquiry text, email addresses or API secrets.
   Alerts must reach the operator through a channel independent of the failing
   lead-email provider. Confirm that channel before activation.
10. Run the acceptance checklist below in preview, then publish and run a marked
    production QA request with measurement unchecked. Verify its actual inbox
    delivery and persisted ID. Preserve the previous Vercel deployment for rollback.

## Ads measurement

`ADS_ENABLED=false` is the default. Configure `GOOGLE_ADS_ID` (`AW-...`) and
`GOOGLE_ADS_LABEL` only from the verified conversion action. Do not guess them.
Google's tag is loaded only after the visitor checks optional measurement consent.
An accepted response emits `conversion` with `transaction_id=lead_id`.
`ad_user_data` and `ad_personalization` remain denied; enhanced conversions and
remarketing are not implemented. Unchecking measurement sets storage consent to
denied; it does not retract previous events or erase existing Google cookies.
No Google tag is loaded for a visitor who never opts in.

Configure the action as Quote request received, count One, and choose one primary
source for this action. Do not additionally import the same event from GA4 as a
separate primary action. Phone/email clicks are separate secondary interactions.
Inspect existing tags/actions first. Use Tag Assistant for consent and event QA;
validate attributed reporting with an approved controlled ad interaction. A fake
GCLID and unit-test event do not prove Google Ads attribution.

`fp_conversion_events` is the source ledger, NOT proof of successful Google Ads
receipt. `eligible` means consent was recorded; it does not mean an ad was present
or an event reached Google. Retained click IDs and campaign values are untrusted
attribution inputs, not authorization or evidence of a real ad click. A server-side
Data Manager integration is not implemented or enabled in this release. Before
adding one, confirm consent, supported matching, and shared-ID deduplication with
the website action. Reconcile attributed counts separately from all received leads.

## Restricted operations

- `GET /api/lead-ops` with the separate admin Bearer token returns queue counts.
- `GET /api/lead-ops?view=leads` returns up to 100 leads with notification and
  consent status. Use its opaque `next_before` cursor as `before` for the next page.
- Every response is `Cache-Control: no-store`; never share the token or put it in
  a query string. This API is for authenticated operator tooling, not a public
  browser dashboard. Use an existing authenticated admin environment to export.
- Timestamps are stored in UTC. Display them with `America/Chicago` for business
  users; do not hard-code CST or a fixed UTC offset. The JSON export includes full
  precision timestamps so pagination cannot skip simultaneous records.

## Email reliability and limitations

The worker locks one row at a time with a lease; a crashed worker can be recovered.
Each attempt uses the same stored payload and provider idempotency key. Resend's
24-hour deduplication retention is bounded: ambiguous retries stop after 23 hours
or eight attempts and enter `review`. This avoids silently resending after the
provider forgets its key. Check the provider by ID before manually recovering a
review item. Do not blindly reset the state or change the stored payload.

`sent` means the provider accepted the email, not that it reached Tony's inbox.
The provider ID is available for delivery/bounce investigation. Automated signed
provider webhooks are not included. Check provider delivery/bounce monitoring and
prove inbox receipt during launch. Stored leads remain available even if every
notification attempt fails. An active retry scheduler and independent alerts are
mandatory launch dependencies, not features proven by local tests.

## Acceptance checklist (not yet executed against external services)

- Valid desktop and mobile submissions: one receipt/row/outbox, same ID in inbox.
- Blank/invalid input, oversized body, honeypot and invalid/expired challenge:
  no saved lead and no conversion.
- Double click and timeout-after-commit retry: one lead, same receipt.
- Database outage: no success message; form values preserved.
- Mail outage/recovery: accepted lead survives; worker retries; inbox checked.
- Expired worker lease and ambiguous send beyond retry window: visible review.
- Unauthenticated operations/worker: 401, no contact data returned.
- Consent denied: no Google tag; no ad identifiers stored. Consent granted:
  one conversion after receipt; error/refresh produces no extra conversion.
- Verify endpoint IP handling on Vercel, actual PostgreSQL concurrent requests,
  and scheduler cadence on the chosen plan.
- Check notification alert independently; review backup and retention process.
- Compare accepted QA IDs with database, provider status and inbox; then remove
  or mark test data through the controlled admin process. Never count test leads
  as advertising conversions.

## Local evidence

`npm test` runs browser-DOM behavior tests with jsdom and PostgreSQL SQL tests with
PGlite. External Turnstile and email calls are mocked; these tests do not prove
live credentials, DNS, inbox delivery, Vercel packaging, or Ads attribution.
`npm run build` copies only public HTML/assets to dist; server source, migrations,
node_modules and environment files are excluded from the static output.

## Rollback

Revert to the previous Vercel deployment if acceptance fails. Keep the dedicated
lead database and outbox for recovery; do not drop or overwrite accepted records.
If only the mail provider fails, keep capture online and repair delivery. A failed
database must prevent false success. Turning off `LEADS_ENABLED` disables the
form with phone/email alternatives; it is an emergency pause, not the normal state.
