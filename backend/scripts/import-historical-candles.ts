/**
 * Імпорт історичних денних свічок із data/historical/*.csv у ohlcv_candles.
 *
 * НАВІЩО: у БД свічки потрапляють лише коли ви відкриваєте дашборд, а Yahoo
 * віддає обмежене вікно (~4 місяці). Тому візуальний бектест показував графік
 * із березня 2026, хоча вердикти є з 2020 — смуги малювались за межами видимих
 * даних (виявлено 2026-07-21).
 *
 * CSV від OANDA містять історію з 2019 року. Формат: time,open,high,low,close
 * (time — unix seconds). Об'єму немає — це нормально, для форексу його й так
 * не існує в осмисленому вигляді.
 *
 * Запуск: npx ts-node scripts/import-historical-candles.ts
 * Безпечно повторювати: ON CONFLICT DO NOTHING, наявні свічки не чіпаються.
 */

import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const CSV_DIR = join(__dirname, '../../data/historical');

/** OANDA_EURUSD, 1D_e33ec.csv → EUR/USD */
function pairFromFilename(name: string): string | null {
  const m = name.match(/OANDA_([A-Z]{6}),/);
  if (!m) return null;
  const s = m[1];
  return `${s.slice(0, 3)}/${s.slice(3)}`;
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'macrotrade',
    user: process.env.DB_USER ?? 'admin',
    password: process.env.DB_PASSWORD ?? '',
  });
  await client.connect();

  const files = readdirSync(CSV_DIR).filter((f) => f.endsWith('.csv'));
  console.log(`Знайдено CSV: ${files.length}\n`);

  let totalInserted = 0;

  for (const file of files) {
    const pair = pairFromFilename(file);
    if (!pair) {
      console.warn(`  ? ${file} — не вдалось визначити пару, пропуск`);
      continue;
    }

    const lines = readFileSync(join(CSV_DIR, file), 'utf-8').split('\n').filter(Boolean);
    const rows: Array<[string, string, string, number, number, number, number, number]> = [];

    for (let i = 1; i < lines.length; i++) {   // 0 — заголовок
      const [t, o, h, l, c] = lines[i].split(',');
      const ts = Number(t);
      const open = Number(o), high = Number(h), low = Number(l), close = Number(c);
      if (![ts, open, high, low, close].every(Number.isFinite)) continue;
      if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue;

      // timestamp у БД зберігається в мілісекундах
      rows.push([pair, 'daily', String(ts * 1000), open, high, low, close, 0]);
    }

    if (!rows.length) {
      console.warn(`  ✗ ${pair}: валідних рядків немає`);
      continue;
    }

    // Пакетна вставка — по 500 рядків, щоб не впертись у ліміт параметрів
    let inserted = 0;
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const values: any[] = [];
      const placeholders = chunk.map((r, j) => {
        const b = j * 8;
        values.push(...r);
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`;
      }).join(',');

      const res = await client.query(
        `INSERT INTO ohlcv_candles (pair, timeframe, timestamp, open, high, low, close, volume)
         VALUES ${placeholders}
         ON CONFLICT DO NOTHING`,
        values,
      );
      inserted += res.rowCount ?? 0;
    }

    const first = new Date(Number(rows[0][2])).toISOString().slice(0, 10);
    const last = new Date(Number(rows[rows.length - 1][2])).toISOString().slice(0, 10);
    console.log(`  ✓ ${pair.padEnd(9)} ${String(rows.length).padStart(5)} рядків | нових: ${String(inserted).padStart(5)} | ${first} → ${last}`);
    totalInserted += inserted;
  }

  const { rows: summary } = await client.query(
    `SELECT pair, COUNT(*) AS n,
            MIN(to_timestamp(timestamp/1000))::date AS від,
            MAX(to_timestamp(timestamp/1000))::date AS до
     FROM ohlcv_candles WHERE timeframe='daily' GROUP BY pair ORDER BY pair`,
  );

  console.log(`\nВставлено нових: ${totalInserted}\n`);
  console.log('Підсумок daily-свічок у БД:');
  for (const r of summary) {
    console.log(`  ${r.pair.padEnd(9)} ${String(r.n).padStart(5)} | ${r.від} → ${r.до}`);
  }

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
