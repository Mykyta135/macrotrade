/**
 * Import AAII weekly sentiment CSV into aaii_sentiment table.
 * Run: npx ts-node scripts/import-aaii.ts
 *
 * CSV date format: M-D-YY (e.g. 1-2-20 = 2020-01-02)
 * Columns: Date, Bullish, Neutral, Bearish, Total, 8wkAvg, Bull-Bear Spread, ...
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

const CSV_PATH = path.join(__dirname, '../../sentiment.csv');

function parseDate(raw: string): string | null {
  // Format: M-D-YY
  const m = raw.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (!m) return null;
  const month = m[1].padStart(2, '0');
  const day   = m[2].padStart(2, '0');
  const yr    = m[3].length === 2 ? (parseInt(m[3]) >= 87 ? '19' + m[3] : '20' + m[3]) : m[3];
  return `${yr}-${month}-${day}`;
}

function parsePct(raw: string): number | null {
  const s = raw.trim().replace('%', '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

async function main() {
  const client = new Client({
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     parseInt(process.env.DB_PORT ?? '5432'),
    database: process.env.DB_NAME     ?? 'macrotrade',
    user:     process.env.DB_USER     ?? 'admin',
    password: process.env.DB_PASSWORD ?? '',
  });
  await client.connect();

  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.split('\n');

  let inserted = 0;
  let skipped  = 0;

  for (const line of lines) {
    const cols = line.split(',');
    if (cols.length < 4) { skipped++; continue; }

    const dateRaw = cols[0].trim();
    const date = parseDate(dateRaw);
    if (!date) { skipped++; continue; }

    // Only 2020-01-01 onwards
    if (date < '2020-01-01') { skipped++; continue; }

    const bullish = parsePct(cols[1]);
    const neutral = parsePct(cols[2]);
    const bearish = parsePct(cols[3]);
    if (bullish === null || neutral === null || bearish === null) { skipped++; continue; }

    // Bull-Bear spread is col index 6 (0-based: 6th column after Date)
    const spread = cols[6] ? parsePct(cols[6]) : null;

    await client.query(
      `INSERT INTO aaii_sentiment ("reportDate", "bullishPct", "neutralPct", "bearishPct", "bullBearSpread")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("reportDate") DO UPDATE
         SET "bullishPct" = $2, "neutralPct" = $3, "bearishPct" = $4, "bullBearSpread" = $5`,
      [date, bullish, neutral, bearish, spread],
    );
    inserted++;
  }

  await client.end();
  console.log(`Done — inserted/updated: ${inserted}, skipped: ${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
