/**
 * Step B — Auto-Labeler
 * Reads features.json, computes historical percentile thresholds,
 * labels each row as LOW_VOL / NORMAL_VOL / HIGH_VOL.
 * Outputs labeled.json.
 *
 * Labeling logic (using primary feature f_atrPct):
 *   - HIGH_VOL: top 20th percentile of atrPct across all history
 *   - LOW_VOL:  bottom 33rd percentile
 *   - NORMAL_VOL: everything in between
 *
 * We use cross-pair percentiles so the model learns universal vol levels,
 * not pair-specific ones (EUR/USD 0.3% ATR ≠ GBP/JPY 0.3% ATR in meaning).
 */

const fs = require('fs');
const path = require('path');

const FEATURES_FILE = path.join(__dirname, 'features.json');
const OUT_FILE = path.join(__dirname, 'labeled.json');

function percentile(sortedArr, pct) {
  const idx = Math.floor((pct / 100) * sortedArr.length);
  return sortedArr[Math.min(idx, sortedArr.length - 1)];
}

function run() {
  const rows = JSON.parse(fs.readFileSync(FEATURES_FILE, 'utf-8'));

  // Sort all atrPct values to compute global percentiles
  const allAtrPcts = rows.map(r => r.f_atrPct).sort((a, b) => a - b);
  const p33 = percentile(allAtrPcts, 33);
  const p80 = percentile(allAtrPcts, 80);

  console.log(`Global ATR% thresholds:`);
  console.log(`  LOW_VOL  < ${(p33 * 100).toFixed(4)}%`);
  console.log(`  NORMAL_VOL  ${(p33 * 100).toFixed(4)}% – ${(p80 * 100).toFixed(4)}%`);
  console.log(`  HIGH_VOL > ${(p80 * 100).toFixed(4)}%`);

  // Label each row
  const labeled = rows.map(r => {
    let label;
    if (r.f_atrPct >= p80) label = 'HIGH_VOL';
    else if (r.f_atrPct <= p33) label = 'LOW_VOL';
    else label = 'NORMAL_VOL';

    return { ...r, label };
  });

  // Print distribution
  const counts = { LOW_VOL: 0, NORMAL_VOL: 0, HIGH_VOL: 0 };
  labeled.forEach(r => counts[r.label]++);
  const total = labeled.length;
  console.log(`\nLabel distribution:`);
  console.log(`  LOW_VOL:    ${counts.LOW_VOL} (${(counts.LOW_VOL / total * 100).toFixed(1)}%)`);
  console.log(`  NORMAL_VOL: ${counts.NORMAL_VOL} (${(counts.NORMAL_VOL / total * 100).toFixed(1)}%)`);
  console.log(`  HIGH_VOL:   ${counts.HIGH_VOL} (${(counts.HIGH_VOL / total * 100).toFixed(1)}%)`);

  // Print some high-vol dates as sanity check
  const highVolDates = labeled
    .filter(r => r.label === 'HIGH_VOL' && r.pair === 'EUR/USD')
    .slice(0, 10)
    .map(r => `${r.date} (atrPct=${(r.f_atrPct * 100).toFixed(3)}%)`);
  console.log(`\nSample HIGH_VOL days (EUR/USD):\n  ${highVolDates.join('\n  ')}`);

  fs.writeFileSync(OUT_FILE, JSON.stringify(labeled, null, 2));
  console.log(`\nOutput: ${OUT_FILE}`);
}

run();
