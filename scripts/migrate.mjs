import { readFile } from 'node:fs/promises';
import { getDb } from '../server/db.js';
if (process.env.CONFIRM_LEAD_DATABASE !== 'fleetpilot360') throw new Error('Set CONFIRM_LEAD_DATABASE=fleetpilot360 for the dedicated lead database.');
const db = getDb();
try { await db.query(await readFile(new URL('../migrations/001_leads.sql',import.meta.url),'utf8')); console.log('FleetPilot360 lead schema ready.'); }
finally { await db.end(); }
