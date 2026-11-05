# FleetPilot360 Website

Production marketing website for FleetPilot360.

- Customer portal: https://app.fleetpilot360.com
- Sales phone: 956-440-9800
- Sales email: tony@sharp-abs.com

This repository is configured for deployment with Vercel.
Last updated: September 2026

## Reliable quote requests

The lead-capture branch adds a Vercel API, a dedicated PostgreSQL lead register,
a durable notification outbox, Turnstile verification and optional Google Ads
conversion events after a committed receipt. See
[setup, launch gates and operations](docs/lead-capture-operations.md).

- `npm ci` installs the locked dependencies.
- `npm test` checks receipt, validation, failure recovery, SQL and form behavior.
- `npm run build` creates the static public `dist/` output.
- `.env.example` lists required secret names; never commit populated secrets.

Production activation requires verified external services and a real inbox test.
