/**
 * ЕКСПЕРИМЕНТ 2: чи можна взагалі ПРОГНОЗУВАТИ волатильність завтра?
 *
 * Поточна модель класифікує СЬОГОДНІШНІЙ режим за СЬОГОДНІШНІМИ ознаками.
 * Це опис, а не прогноз — і саме тому виникає витік мітки.
 *
 * Тут перевіряємо чесну прогнозну задачу: за ознаками дня T передбачити
 * режим дня T+1. Мітка з майбутнього, ознаки з минулого — витік неможливий.
 *
 * Порівнюємо з двома базовими лініями, які треба перебити:
 *   - "завжди NORMAL_VOL" (найчастіша мітка)
 *   - "завтра = сьогодні" (persistence) — волатильність кластеризується,
 *     тож це сильний суперник. Якщо ML його не перебиває, ML не потрібен.
 *
 * Нічого не перезаписує. Запуск: node experiment-forecast.js
 */

const fs = require('fs');
const path = require('path');

const LABELED_FILE = path.join(__dirname, 'labeled.json');
const K = 7;

// Без f_atrPct — саме він створює витік у поточній моделі
const FEATURES = ['f_stdDev20', 'f_bbWidth', 'f_bodyRatio', 'f_hlRange', 'f_dirEfficiency'];
const WEIGHTS = { f_stdDev20: 1.5, f_bbWidth: 1.5, f_bodyRatio: 0.8, f_hlRange: 1.2, f_dirEfficiency: 0.8 };

function normParams(rows) {
  const p = {};
  for (const f of FEATURES) {
    let min = Infinity, max = -Infinity;
    for (const r of rows) {
      const v = r[f];
      if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; }
    }
    p[f] = { min, max };
  }
  return p;
}

const norm = (row, p) => Object.fromEntries(
  FEATURES.map(f => {
    const span = p[f].max - p[f].min;
    return [f, span === 0 ? 0 : ((row[f] ?? p[f].min) - p[f].min) / span];
  })
);

function dist(a, b) {
  let s = 0;
  for (const f of FEATURES) { const d = (a[f] - b[f]) * WEIGHTS[f]; s += d * d; }
  return Math.sqrt(s);
}

function predict(q, train, k) {
  const ds = train.map(p => ({ label: p.targetLabel, d: dist(q, p.normalized) }));
  ds.sort((x, y) => x.d - y.d);
  const votes = {};
  for (const n of ds.slice(0, k)) votes[n.label] = (votes[n.label] || 0) + 1;
  return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
}

function run() {
  const rows = JSON.parse(fs.readFileSync(LABELED_FILE, 'utf-8'));

  // ── Побудова прогнозної вибірки: ознаки дня T → мітка дня T+1 ──────────
  const byPair = {};
  for (const r of rows) (byPair[r.pair] ||= []).push(r);
  for (const p of Object.values(byPair)) p.sort((a, b) => a.date.localeCompare(b.date));

  const samples = [];
  for (const [pair, list] of Object.entries(byPair)) {
    for (let i = 0; i < list.length - 1; i++) {
      const today = list[i], tomorrow = list[i + 1];
      // Пропускаємо розриви більші за 5 днів (вихідні/свята — ок, дірки в даних — ні)
      const gap = (new Date(tomorrow.date) - new Date(today.date)) / 86400000;
      if (gap > 5) continue;
      samples.push({
        pair, date: today.date,
        ...Object.fromEntries(FEATURES.map(f => [f, today[f]])),
        todayLabel: today.label,
        targetLabel: tomorrow.label,   // ← мітка з МАЙБУТНЬОГО
      });
    }
  }

  const p = normParams(samples);
  const points = samples.map(s => ({ ...s, normalized: norm(s, p) }));

  // ── Часове розділення: навчання на минулому, перевірка на майбутньому ──
  points.sort((a, b) => a.date.localeCompare(b.date));
  const cut = Math.floor(points.length * 0.8);
  const train = points.slice(0, cut);
  const val = points.slice(cut);

  const step = Math.max(1, Math.floor(val.length / 1200));
  const sample = val.filter((_, i) => i % step === 0);

  // ── Базові лінії ──────────────────────────────────────────────────────
  const counts = {};
  for (const s of sample) counts[s.targetLabel] = (counts[s.targetLabel] || 0) + 1;
  const majorityLabel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const majorityAcc = counts[majorityLabel] / sample.length;

  // Persistence: "завтра буде як сьогодні"
  const persistAcc = sample.filter(s => s.todayLabel === s.targetLabel).length / sample.length;

  // ── KNN-прогноз ───────────────────────────────────────────────────────
  let correct = 0;
  const conf = { LOW_VOL: {}, NORMAL_VOL: {}, HIGH_VOL: {} };
  for (const s of sample) {
    const pred = predict(s.normalized, train, K);
    conf[s.targetLabel][pred] = (conf[s.targetLabel][pred] || 0) + 1;
    if (pred === s.targetLabel) correct++;
  }
  const knnAcc = correct / sample.length;

  // ── Вивід ─────────────────────────────────────────────────────────────
  console.log('═'.repeat(74));
  console.log('ЕКСПЕРИМЕНТ 2: ПРОГНОЗ волатильності на завтра (T → T+1)');
  console.log('═'.repeat(74));
  console.log(`Прикладів: ${points.length} | навчання: ${train.length} | перевірка: ${sample.length}`);
  console.log(`Розділення ЧАСОВЕ: навчання до ${train[train.length-1].date}, перевірка після\n`);

  console.log('РЕЗУЛЬТАТИ:');
  console.log(`  1. Базова "завжди ${majorityLabel}"      ${(majorityAcc*100).toFixed(1).padStart(5)}%`);
  console.log(`  2. Persistence "завтра = сьогодні"  ${(persistAcc*100).toFixed(1).padStart(5)}%   ← головний суперник`);
  console.log(`  3. KNN-прогноз (5 ознак)            ${(knnAcc*100).toFixed(1).padStart(5)}%`);

  const vsMajority = (knnAcc - majorityAcc) * 100;
  const vsPersist = (knnAcc - persistAcc) * 100;
  console.log(`\n  KNN проти базової:      ${vsMajority >= 0 ? '+' : ''}${vsMajority.toFixed(1)} п.п.`);
  console.log(`  KNN проти persistence:  ${vsPersist >= 0 ? '+' : ''}${vsPersist.toFixed(1)} п.п.`);

  console.log('\nМАТРИЦЯ ПОМИЛОК (рядки = справжня мітка завтра, стовпці = прогноз):');
  const labels = ['LOW_VOL', 'NORMAL_VOL', 'HIGH_VOL'];
  console.log('               ' + labels.map(l => l.padStart(11)).join(''));
  for (const a of labels) {
    const row = labels.map(pr => String(conf[a][pr] || 0).padStart(11)).join('');
    console.log(a.padEnd(14) + row);
  }

  // Найважливіше практично: чи ловимо HIGH_VOL?
  const hvTotal = labels.reduce((s, l) => s + (conf.HIGH_VOL[l] || 0), 0);
  const hvCaught = conf.HIGH_VOL.HIGH_VOL || 0;
  console.log(`\nВИЯВЛЕННЯ HIGH_VOL (найцінніше для трейдера):`);
  console.log(`  спіймано ${hvCaught} із ${hvTotal} = ${hvTotal ? (hvCaught/hvTotal*100).toFixed(1) : 0}% (recall)`);

  console.log('\n' + '═'.repeat(74));
  console.log('ВИСНОВОК:');
  if (vsPersist > 3) {
    console.log('✓ ML додає цінність понад просте "завтра = сьогодні". Варто розвивати.');
  } else if (vsPersist > -2) {
    console.log('⚠ ML практично дорівнює persistence. Складність не окупається —');
    console.log('  дешевше писати "завтра як сьогодні" одним рядком коду.');
  } else {
    console.log('✗ ML ГІРШИЙ за persistence. Прогнозувати мітку завтра цими ознаками не виходить.');
  }
  console.log('═'.repeat(74));
}

run();
