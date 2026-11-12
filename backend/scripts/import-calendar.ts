/**
 * One-time import of Forex Factory historical calendar CSV into postgres.
 * Run: npx ts-node scripts/import-calendar.ts
 *
 * Reads: ../forexfactory-scraper/high_impact_events_calendar.csv
 * Writes: calendar_events table (upsert — safe to re-run)
 */

import 'dotenv/config';
import { createReadStream } from 'fs';
import { resolve } from 'path';
import { parse } from 'csv-parse';
import { Client } from 'pg';

const CSV_PATH = resolve(__dirname, '../../forexfactory-scraper/high_impact_events_calendar.csv');

async function main() {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'macrotrade',
    user: process.env.DB_USER ?? 'admin',
    password: process.env.DB_PASSWORD ?? '',
  });

  await client.connect();
  console.log('Connected to DB');

  // Table is created by TypeORM synchronize — just ensure the unique constraint exists
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_cal_date_currency_event'
      ) THEN
        ALTER TABLE calendar_events
          ADD CONSTRAINT uq_cal_date_currency_event UNIQUE (event_date, currency, event);
      END IF;
    END $$;
  `);

  const records: any[] = [];
  let skipped = 0;

  await new Promise<void>((resolve, reject) => {
    createReadStream(CSV_PATH)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on('data', (row: any) => {
        const dt = new Date(row.DateTime);
        if (isNaN(dt.getTime())) { skipped++; return; }
        records.push({
          event_date: dt.toISOString(),
          currency: (row.Currency ?? '').trim().substring(0, 8),
          impact: (row.Impact ?? '').trim().substring(0, 64),
          event: (row.Event ?? '').trim().substring(0, 255),
          actual: (row.Actual ?? '').trim().substring(0, 32) || null,
          forecast: (row.Forecast ?? '').trim().substring(0, 32) || null,
          previous: (row.Previous ?? '').trim().substring(0, 32) || null,
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`Parsed ${records.length} records (${skipped} skipped)`);

  let inserted = 0;
  let conflicts = 0;
  const BATCH = 500;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    for (const r of batch) {
      const res = await client.query(
        `INSERT INTO calendar_events(event_date, currency, impact, event, actual, forecast, previous)
         VALUES($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT ON CONSTRAINT uq_cal_date_currency_event DO NOTHING`,
        [r.event_date, r.currency, r.impact, r.event, r.actual, r.forecast, r.previous],
      );
      if (res.rowCount === 0) conflicts++;
      else inserted++;
    }
    process.stdout.write(`\r${i + batch.length}/${records.length} rows processed...`);
  }

  console.log(`\nDone — ${inserted} inserted, ${conflicts} skipped (duplicates)`);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
