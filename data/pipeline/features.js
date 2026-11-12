/**
 * Step A — Feature Engineering
 * Reads all OANDA CSV files, computes volatility features per candle,
 * outputs a single features.json for the labeler and trainer.
 */

const fs = require('fs');
const path = require('path');

const HISTORICAL_DIR = path.join(__dirname, '..', 'historical');
const OUT_FILE = path.join(__dirname, 'features.json');

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
  // header: time,open,high,low,close
  return lines.slice(1).map(line => {
    const [time, open, high, low, close] = line.split(',').map(Number);
    return { time, open, high, low, close };
  }).filter(c => !isNaN(c.close) && c.close > 0);
}

// ── Feature functions (all pure, no side effects) ─────────────────────────────

function computeATR(candles, period = 14) {
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    trs.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prev),
      Math.abs(candles[i].low - prev),
    ));
  }
  // Rolling ATR using simple moving average
  const atrs = new Array(candles.length).fill(null);
  for (let i = period; i < candles.length; i++) {
    atrs[i] = trs.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
  }
  return atrs;
}

function computeATRPct(candles, atrs) {
  // ATR as % of close price — normalizes across pairs (JPY pairs have large nominal ATR)
  return atrs.map((atr, i) => atr !== null ? atr / candles[i].close : null);
}

function computeStdDev(candles, period = 20) {
  const closes = candles.map(c => c.close);
  const stdDevs = new Array(candles.length).fill(null);
  for (let i = period; i < candles.length; i++) {
    const window = closes.slice(i - period, i);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    stdDevs[i] = Math.sqrt(variance) / closes[i]; // normalize as % of price
  }
  return stdDevs;
}

function computeBBWidth(candles, period = 20, multiplier = 2) {
  // Bollinger Band width = (upper - lower) / middle — normalized width
  const closes = candles.map(c => c.close);
  const bbWidths = new Array(candles.length).fill(null);
  for (let i = period; i < candles.length; i++) {
    const window = closes.slice(i - period, i);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(window.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period);
    bbWidths[i] = (multiplier * 2 * stdDev) / mean;
  }
  return bbWidths;
}

function computeBodyRatio(candles, period = 10) {
  // Rolling avg body/range ratio — low = more wicks (indecision/volatility)
  const ratios = candles.map(c => {
    const range = c.high - c.low;
    return range === 0 ? 1 : Math.abs(c.close - c.open) / range;
  });
  const rolling = new Array(candles.length).fill(null);
  for (let i = period; i < candles.length; i++) {
    rolling[i] = ratios.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
  }
  return rolling;
}

function computeHighLowRange(candles, period = 5) {
  // Rolling avg of (high-low)/close — raw intraday range %
  const ranges = candles.map(c => (c.high - c.low) / c.close);
  const rolling = new Array(candles.length).fill(null);
  for (let i = period; i < candles.length; i++) {
    rolling[i] = ranges.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
  }
  return rolling;
}

function computeDirectionalEfficiency(candles, period = 10) {
  // Net move / sum of all moves — high = trending, low = choppy
  const efficiency = new Array(candles.length).fill(null);
  for (let i = period; i < candles.length; i++) {
    const window = candles.slice(i - period, i);
    const netMove = Math.abs(window[window.length - 1].close - window[0].close);
    const totalPath = window.reduce((sum, c, j) => {
      if (j === 0) return sum;
      return sum + Math.abs(c.close - window[j - 1].close);
    }, 0);
    efficiency[i] = totalPath === 0 ? 0 : netMove / totalPath;
  }
  return efficiency;
}

// ── Main per-pair feature extraction ─────────────────────────────────────────

function extractFeatures(pair, candles) {
  const atrs = computeATR(candles, 14);
  const atrPcts = computeATRPct(candles, atrs);
  const stdDevs = computeStdDev(candles, 20);
  const bbWidths = computeBBWidth(candles, 20);
  const bodyRatios = computeBodyRatio(candles, 10);
  const hlRanges = computeHighLowRange(candles, 5);
  const dirEfficiency = computeDirectionalEfficiency(candles, 10);

  const warmup = 20; // skip first N candles where features aren't ready
  const rows = [];

  for (let i = warmup; i < candles.length; i++) {
    if (
      atrPcts[i] === null || stdDevs[i] === null || bbWidths[i] === null ||
      bodyRatios[i] === null || hlRanges[i] === null || dirEfficiency[i] === null
    ) continue;

    rows.push({
      pair,
      date: new Date(candles[i].time * 1000).toISOString().slice(0, 10),
      timestamp: candles[i].time,
      // Raw values for reference
      close: candles[i].close,
      atr14: atrs[i],
      // Features (all normalized — comparable across pairs)
      f_atrPct: atrPcts[i],        // ATR as % of price — primary volatility signal
      f_stdDev20: stdDevs[i],       // 20-day price StdDev as % of price
      f_bbWidth: bbWidths[i],       // Bollinger Band width — vol compression/expansion
      f_bodyRatio: bodyRatios[i],   // Body/range ratio — high wicks = chaotic
      f_hlRange: hlRanges[i],       // Intraday range % — raw volatility
      f_dirEfficiency: dirEfficiency[i], // Trending vs choppy
    });
  }

  return rows;
}

// ── Run ───────────────────────────────────────────────────────────────────────

function run() {
  const csvFiles = fs.readdirSync(HISTORICAL_DIR).filter(f => f.endsWith('.csv'));

  // Pair name extraction from filename e.g. "OANDA_EURUSD, 1D_e33ec.csv" → "EUR/USD"
  const pairFromFilename = (filename) => {
    const match = filename.match(/OANDA_([A-Z]+),/);
    if (!match) return filename;
    const raw = match[1]; // e.g. "EURUSD"
    return raw.slice(0, 3) + '/' + raw.slice(3); // "EUR/USD"
  };

  const allRows = [];

  for (const file of csvFiles) {
    const pair = pairFromFilename(file);
    const filePath = path.join(HISTORICAL_DIR, file);
    const candles = parseCSV(filePath);
    const rows = extractFeatures(pair, candles);
    allRows.push(...rows);
    console.log(`[${pair}] ${rows.length} feature rows extracted`);
  }

  // Sort by date
  allRows.sort((a, b) => a.timestamp - b.timestamp);

  fs.writeFileSync(OUT_FILE, JSON.stringify(allRows, null, 2));
  console.log(`\nTotal rows: ${allRows.length}`);
  console.log(`Output: ${OUT_FILE}`);
}

run();
