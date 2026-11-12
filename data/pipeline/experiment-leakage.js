/**
 * ЕКСПЕРИМЕНТ: скільки з 94.7% точності — це витік мітки?
 *
 * Гіпотеза: мітка ставиться виключно за порогом f_atrPct (див. label.js),
 * а f_atrPct водночас є ознакою №1 з найбільшою вагою (2.0). Тобто модель
 * бачить на вході ту саму величину, з якої вирахувано правильну відповідь,
 * і 94.7% означають "KNN успішно апроксимує if atrPct >= поріг", а не
 * "модель навчилась розпізнавати режим ринку".
 *
 * Перевіряємо чотири конфігурації:
 *   A. Як зараз (з f_atrPct)              — очікуємо ~94.7%
 *   B. Без f_atrPct                       — справжня точність за формою свічок
 *   C. Без f_atrPct і без f_stdDev20/bbWidth (теж похідні від волатильності)
 *   D. Базова лінія: завжди відповідати найчастішою міткою
 *
 * Плюс окремо: валідація з розділенням ПО ПАРАХ, бо в train.js хвостові 20%
 * можуть містити ті самі дні по інших парах — сусідні пари в один день
 * корелюють, і це теж завищує оцінку.
 *
 * Нічого не перезаписує. Запуск: node experiment-leakage.js
 */

const fs = require('fs');
const path = require('path');

const LABELED_FILE = path.join(__dirname, 'labeled.json');
const K = 7;

const ALL_WEIGHTS = {
  f_atrPct: 2.0, f_stdDev20: 1.5, f_bbWidth: 1.5,
  f_bodyRatio: 0.8, f_hlRange: 1.2, f_dirEfficiency: 0.8,
};

const CONFIGS = [
  { name: 'A. Усі 6 ознак (як зараз)',        features: ['f_atrPct','f_stdDev20','f_bbWidth','f_bodyRatio','f_hlRange','f_dirEfficiency'] },
  { name: 'B. Без f_atrPct',                  features: ['f_stdDev20','f_bbWidth','f_bodyRatio','f_hlRange','f_dirEfficiency'] },
  { name: 'C. Лише форма свічок',             features: ['f_bodyRatio','f_hlRange','f_dirEfficiency'] },
];

function computeNormParams(rows, features) {
  const p = {};
  for (const f of features) {
    let min = Infinity, max = -Infinity;
    for (const r of rows) {
      const v = r[f];
      if (typeof v === 'number' && Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    p[f] = { min, max };
  }
  return p;
}

function normalize(row, params, features) {
  const out = {};
  for (const f of features) {
    const { min, max } = params[f];
    const span = max - min;
    out[f] = span === 0 ? 0 : ((row[f] ?? min) - min) / span;
  }
  return out;
}

function dist(a, b, features, weights) {
  let s = 0;
  for (const f of features) {
    const d = (a[f] - b[f]) * (weights[f] ?? 1);
    s += d * d;
  }
  return Math.sqrt(s);
}

function predict(query, trainSet, features, weights, k) {
  const ds = trainSet.map(p => ({ label: p.label, d: dist(query, p.normalized, features, weights) }));
  ds.sort((x, y) => x.d - y.d);
  const votes = {};
  for (const n of ds.slice(0, k)) votes[n.label] = (votes[n.label] || 0) + 1;
  return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
}

/** Оцінка з різними способами розділення даних. */
function evaluate(rows, features, split) {
  const params = computeNormParams(rows, features);
  const points = rows.map(r => ({
    pair: r.pair, date: r.date, label: r.label,
    normalized: normalize(r, params, features),
  }));

  let trainSet, valSet;

  if (split === 'tail') {
    // Як у train.js: останні 20% рядків
    const n = Math.floor(points.length * 0.2);
    trainSet = points.slice(0, -n);
    valSet = points.slice(-n);
  } else {
    // Чесніше: дві пари повністю виносимо з навчання
    const holdout = new Set(['AUD/USD', 'USD/CHF']);
    trainSet = points.filter(p => !holdout.has(p.pair));
    valSet = points.filter(p => holdout.has(p.pair));
  }

  // Підвибірка валідації для швидкості (13k × 11k порівнянь надто повільно)
  const step = Math.max(1, Math.floor(valSet.length / 1200));
  const sample = valSet.filter((_, i) => i % step === 0);

  let correct = 0;
  const conf = {};
  for (const p of sample) {
    const pred = predict(p.normalized, trainSet, features, ALL_WEIGHTS, K);
    conf[p.label] = conf[p.label] || {};
    conf[p.label][pred] = (conf[p.label][pred] || 0) + 1;
    if (pred === p.label) correct++;
  }

  return { acc: correct / sample.length, n: sample.length, conf };
}

function run() {
  const rows = JSON.parse(fs.readFileSync(LABELED_FILE, 'utf-8'));

  // Базова лінія: завжди відповідати найчастішою міткою
  const counts = {};
  for (const r of rows) counts[r.label] = (counts[r.label] || 0) + 1;
  const majority = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const baseline = majority[1] / rows.length;

  console.log('═'.repeat(72));
  console.log('ЕКСПЕРИМЕНТ: чи є витік мітки в KNN-моделі MacroTrade');
  console.log('═'.repeat(72));
  console.log(`Даних: ${rows.length} рядків | K=${K}`);
  console.log(`Розподіл міток: ${JSON.stringify(counts)}`);
  console.log(`\nD. БАЗОВА ЛІНІЯ (завжди "${majority[0]}"): ${(baseline * 100).toFixed(1)}%`);
  console.log('   ↑ будь-яка модель, що дає менше — гірша за монетку\n');

  for (const split of ['tail', 'bypair']) {
    console.log('─'.repeat(72));
    console.log(split === 'tail'
      ? 'РОЗДІЛЕННЯ ЯК У train.js (останні 20% рядків)'
      : 'РОЗДІЛЕННЯ ПО ПАРАХ (AUD/USD + USD/CHF повністю поза навчанням)');
    console.log('─'.repeat(72));

    for (const cfg of CONFIGS) {
      const { acc, n } = evaluate(rows, cfg.features, split);
      const delta = acc - baseline;
      const verdict = delta > 0.15 ? '✓ сильно краще за базу'
                    : delta > 0.05 ? '~ помірно краще'
                    : delta > 0     ? '⚠ ледь краще за базу'
                                    : '✗ гірше за базу';
      console.log(
        `${cfg.name.padEnd(32)} ${(acc * 100).toFixed(1).padStart(5)}%  ` +
        `(n=${n}, ознак: ${cfg.features.length})  ${verdict}`
      );
    }
    console.log('');
  }

  console.log('═'.repeat(72));
  console.log('ЯК ЧИТАТИ:');
  console.log('Якщо A значно вище за B — модель здебільшого читає відповідь із входу');
  console.log('(f_atrPct — це те, з чого рахується мітка в label.js).');
  console.log('Реальна прогнозна сила — це B і C відносно базової лінії D.');
  console.log('═'.repeat(72));
}

run();
