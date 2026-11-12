/**
 * ЕКСПЕРИМЕНТ 3: прогноз ЗМІНИ режиму (те, де persistence безпорадний).
 *
 * ЧОМУ НЕ "НАЙКРАЩА ТОЧНІСТЬ":
 * Загальну точність у цій задачі вже вичерпано — persistence дає 93.2%,
 * і перебити її можна лише витоком мітки. Але persistence має сліпу зону:
 * він НІКОЛИ не передбачає змін (за визначенням 0% recall на переходах).
 * А трейдера цікавлять саме переходи: спокій → вибух.
 *
 * Задача: за ознаками дня T передбачити, чи ЗМІНИТЬСЯ режим у день T+1.
 * Мітка з майбутнього, ознаки з минулого — витік неможливий.
 *
 * Метрика — НЕ accuracy (класи незбалансовані, "змін не буде" дасть ~85%
 * і буде марним). Дивимось precision / recall / F1 на класі "зміна буде",
 * і окремо — на найцінніший підклас "стрибок у HIGH_VOL".
 *
 * Нічого не перезаписує. Запуск: node experiment-regime-change.js
 */

const fs = require('fs');
const path = require('path');

const LABELED_FILE = path.join(__dirname, 'labeled.json');
const FEATURES = ['f_stdDev20', 'f_bbWidth', 'f_bodyRatio', 'f_hlRange', 'f_dirEfficiency'];
const WEIGHTS = { f_stdDev20: 1.5, f_bbWidth: 1.5, f_bodyRatio: 0.8, f_hlRange: 1.2, f_dirEfficiency: 0.8 };

// ── Побудова прикладів ───────────────────────────────────────────────────
function buildSamples(rows) {
  const byPair = {};
  for (const r of rows) (byPair[r.pair] ||= []).push(r);
  for (const p of Object.values(byPair)) p.sort((a, b) => a.date.localeCompare(b.date));

  const out = [];
  for (const [pair, list] of Object.entries(byPair)) {
    for (let i = 1; i < list.length - 1; i++) {
      const prev = list[i - 1], today = list[i], tomorrow = list[i + 1];
      const gap = (new Date(tomorrow.date) - new Date(today.date)) / 86400000;
      if (gap > 5) continue;

      out.push({
        pair, date: today.date,
        ...Object.fromEntries(FEATURES.map(f => [f, today[f]])),
        // Динаміка: куди рухаються ознаки (стиснення часто передує вибуху)
        d_bbWidth: (today.f_bbWidth ?? 0) - (prev.f_bbWidth ?? 0),
        d_stdDev: (today.f_stdDev20 ?? 0) - (prev.f_stdDev20 ?? 0),
        todayLabel: today.label,
        tomorrowLabel: tomorrow.label,
        willChange: today.label !== tomorrow.label,
        willJumpHigh: today.label !== 'HIGH_VOL' && tomorrow.label === 'HIGH_VOL',
      });
    }
  }
  return out;
}

const ALL_FEATURES = [...FEATURES, 'd_bbWidth', 'd_stdDev'];
const ALL_WEIGHTS = { ...WEIGHTS, d_bbWidth: 1.5, d_stdDev: 1.5 };

/** Нормалізація — параметри рахуються ЛИШЕ на навчальній частині (без витоку). */
function fitNorm(train) {
  const p = {};
  for (const f of ALL_FEATURES) {
    let min = Infinity, max = -Infinity;
    for (const r of train) {
      const v = r[f];
      if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; }
    }
    p[f] = { min, max };
  }
  return p;
}

const applyNorm = (row, p) => Object.fromEntries(
  ALL_FEATURES.map(f => {
    const span = p[f].max - p[f].min;
    const v = ((row[f] ?? p[f].min) - p[f].min) / (span || 1);
    return [f, Math.max(0, Math.min(1, v))];   // обрізаємо викиди поза діапазоном навчання
  })
);

function dist(a, b) {
  let s = 0;
  for (const f of ALL_FEATURES) { const d = (a[f] - b[f]) * ALL_WEIGHTS[f]; s += d * d; }
  return Math.sqrt(s);
}

/** Повертає частку сусідів із позитивним класом — це ймовірність, а не мітка. */
function knnProba(q, train, k, key) {
  const ds = train.map(p => ({ y: p[key], d: dist(q, p.normalized) }));
  ds.sort((x, y) => x.d - y.d);
  const top = ds.slice(0, k);
  return top.filter(n => n.y).length / k;
}

function prf(tp, fp, fn) {
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
  return { precision, recall, f1 };
}

function evaluate(train, val, k, key, threshold) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const s of val) {
    const proba = knnProba(s.normalized, train, k, key);
    const pred = proba >= threshold;
    if (pred && s[key]) tp++;
    else if (pred && !s[key]) fp++;
    else if (!pred && s[key]) fn++;
    else tn++;
  }
  return { ...prf(tp, fp, fn), tp, fp, fn, tn, acc: (tp + tn) / val.length };
}

function run() {
  const rows = JSON.parse(fs.readFileSync(LABELED_FILE, 'utf-8'));
  const samples = buildSamples(rows);
  samples.sort((a, b) => a.date.localeCompare(b.date));

  const cut = Math.floor(samples.length * 0.8);
  const trainRaw = samples.slice(0, cut);
  const valRaw = samples.slice(cut);

  // ВАЖЛИВО: нормалізація тільки по train — інакше min/max підглядають у майбутнє
  const p = fitNorm(trainRaw);
  const train = trainRaw.map(s => ({ ...s, normalized: applyNorm(s, p) }));
  const step = Math.max(1, Math.floor(valRaw.length / 1000));
  const val = valRaw.filter((_, i) => i % step === 0).map(s => ({ ...s, normalized: applyNorm(s, p) }));

  console.log('═'.repeat(78));
  console.log('ЕКСПЕРИМЕНТ 3: прогноз ЗМІНИ режиму (T → T+1)');
  console.log('═'.repeat(78));
  console.log(`Навчання: ${train.length} (до ${trainRaw[trainRaw.length-1].date}) | перевірка: ${val.length}`);

  for (const [key, title] of [['willChange', 'ЗМІНА РЕЖИМУ'], ['willJumpHigh', 'СТРИБОК У HIGH_VOL']]) {
    const base = val.filter(s => s[key]).length / val.length;
    console.log('\n' + '─'.repeat(78));
    console.log(`${title} — трапляється у ${(base * 100).toFixed(1)}% днів`);
    console.log('─'.repeat(78));
    console.log('Persistence:  recall 0.0% (ніколи не передбачає змін — сліпа зона)');
    console.log('Випадковий:   precision ≈ ' + (base * 100).toFixed(1) + '% (частота класу)\n');

    console.log('поріг   K   precision   recall      F1     спіймано/усього');
    let best = null;
    for (const k of [7, 15, 25]) {
      for (const t of [0.3, 0.4, 0.5, 0.6]) {
        const r = evaluate(train, val, k, key, t);
        if (!best || r.f1 > best.r.f1) best = { k, t, r };
        console.log(
          `${t.toFixed(1).padStart(4)}  ${String(k).padStart(3)}   ` +
          `${(r.precision * 100).toFixed(1).padStart(7)}%   ` +
          `${(r.recall * 100).toFixed(1).padStart(6)}%  ` +
          `${(r.f1 * 100).toFixed(1).padStart(6)}%   ${r.tp}/${r.tp + r.fn}`
        );
      }
    }

    const lift = best.r.precision / base;
    console.log(`\nНАЙКРАЩЕ: K=${best.k}, поріг=${best.t} → F1=${(best.r.f1*100).toFixed(1)}%`);
    console.log(`Lift над випадковим: ${lift.toFixed(2)}x  ` +
      `(precision ${(best.r.precision*100).toFixed(1)}% проти базових ${(base*100).toFixed(1)}%)`);
    if (lift > 1.5 && best.r.recall > 0.15) {
      console.log('✓ Модель має реальну прогнозну силу на цьому класі.');
    } else if (lift > 1.15) {
      console.log('~ Слабкий, але наявний сигнал. Придатний лише як допоміжний фактор.');
    } else {
      console.log('✗ Сигналу немає — прогнозувати цей клас цими ознаками не виходить.');
    }
  }

  console.log('\n' + '═'.repeat(78));
  console.log('ЯК ЧИТАТИ: lift > 1 означає, що модель краща за випадкове вгадування.');
  console.log('Recall = яку частку подій ловимо. Precision = скільки тривог справжні.');
  console.log('Для торгівлі важливіший recall на HIGH_VOL: пропущений вибух дорожчий');
  console.log('за хибну тривогу.');
  console.log('═'.repeat(78));
}

run();
