/**
 * Будує історію вердиктів для візуального бектесту.
 *
 * Проганяє /api/backtest по кожному робочому дню і зберігає ЛИШЕ вердикт
 * (напрямок + бал), а не повний JSON. Це дає ~800 КБ на 6.5 років замість 382 МБ.
 *
 * Запуск (backend має працювати на :3901):
 *   npx ts-node scripts/build-verdict-history.ts                  # рік назад
 *   npx ts-node scripts/build-verdict-history.ts 2020-01-02       # від дати
 *   npx ts-node scripts/build-verdict-history.ts 2020-01-02 2021-01-01
 *
 * Відновлюваний: уже пораховані дні пропускаються, тож можна перервати
 * (Ctrl+C) і запустити знову. ~1.4 с на день → рік ≈ 6 хв, уся історія ≈ 40 хв.
 */

import 'dotenv/config';
import { Client } from 'pg';
import axios from 'axios';

const API = process.env.BACKTEST_API ?? 'http://localhost:3901/api';

function weekdays(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  while (d <= end) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const from = process.argv[2] ?? new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const to = process.argv[3] ?? today;

  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'macrotrade',
    user: process.env.DB_USER ?? 'admin',
    password: process.env.DB_PASSWORD ?? '',
  });
  await client.connect();

  const days = weekdays(from, to);

  // Пропускаємо вже пораховані — робить скрипт відновлюваним
  const { rows } = await client.query(
    `SELECT DISTINCT date::text AS d FROM daily_verdicts WHERE date BETWEEN $1 AND $2`,
    [from, to],
  );
  const done = new Set(rows.map((r: any) => r.d));
  const todo = days.filter((d) => !done.has(d));

  console.log(`Період ${from} → ${to}`);
  console.log(`Робочих днів: ${days.length} | вже є: ${done.size} | рахуємо: ${todo.length}`);
  console.log(`Оцінка часу: ~${Math.round((todo.length * 1.4) / 60)} хв\n`);

  let ok = 0, empty = 0, failed = 0;
  const started = Date.now();

  for (let i = 0; i < todo.length; i++) {
    const date = todo[i];
    try {
      const { data } = await axios.get(`${API}/backtest?date=${date}`, { timeout: 120_000 });
      const pairs = data?.score?.pairs ?? [];

      if (!pairs.length) { empty++; continue; }

      for (const p of pairs) {
        const blocker = (p.killSwitches ?? []).find((k: any) => !k.passed)?.name ?? null;

        // Куди схилялась система, навіть коли вердикт WATCH/NO TRADE.
        // Бекенд іноді віддає systemBias; якщо ні — дістаємо з тексту
        // рекомендації ("setup valid for SELL EUR/USD but blocked by...").
        const bias =
          p.systemBias
          ?? (p.direction === 'BUY' || p.direction === 'SELL' ? p.direction : null)
          ?? (String(p.tradeRecommendation ?? '').match(/for (BUY|SELL)/)?.[1] ?? null);
        await client.query(
          `INSERT INTO daily_verdicts
             (pair, date, direction, score, bias, grade, "killSwitchBlocked", blocker, "r2Inverted")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (pair, date) DO UPDATE SET
             direction = EXCLUDED.direction, score = EXCLUDED.score,
             bias = EXCLUDED.bias,
             grade = EXCLUDED.grade, "killSwitchBlocked" = EXCLUDED."killSwitchBlocked",
             blocker = EXCLUDED.blocker, "r2Inverted" = EXCLUDED."r2Inverted"`,
          [
            p.pair, date, p.direction, p.totalScore ?? 0, bias, p.grade ?? null,
            !!p.killSwitchBlocked, blocker,
            !!(p.r2InversionNote && String(p.r2InversionNote).includes('INVERSION')),
          ],
        );
      }
      ok++;
    } catch (e: any) {
      failed++;
      if (failed <= 3) console.warn(`  ✗ ${date}: ${e.message}`);
    }

    if ((i + 1) % 20 === 0 || i === todo.length - 1) {
      const elapsed = (Date.now() - started) / 1000;
      const rate = (i + 1) / elapsed;
      const left = Math.round((todo.length - i - 1) / Math.max(rate, 0.01) / 60);
      process.stdout.write(
        `\r  ${i + 1}/${todo.length} | ok:${ok} порожніх:${empty} помилок:${failed} | залишилось ~${left} хв   `,
      );
    }
  }

  const total = await client.query('SELECT COUNT(*) AS n FROM daily_verdicts');
  console.log(`\n\nГотово. Записів у daily_verdicts: ${total.rows[0].n}`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
