import { Injectable } from '@nestjs/common';
import {
  OHLCV,
  TimeframeAnalysis,
  TrendDirection,
  Zone,
  StructureBreak,
  Imbalance,
  VolumeProfile,
  SessionLevels,
  LiquiditySweep,
  LiquidityFlip,
  StackedZone,
  MomentumBias,
  CandleType,
  AlignmentResult,
  PriceVsZones,
  RSIResult,
  DonchianResult,
  BollingerResult,
} from './technical.interfaces';

@Injectable()
export class AnalysisService {

  // ── ATR ──────────────────────────────────────────────────────────────────────

  computeATR(candles: OHLCV[], period = 14): number {
    if (candles.length < period + 1) return 0;
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const { high, low, close: prevClose } = { ...candles[i], close: candles[i - 1].close };
      trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - prevClose), Math.abs(candles[i].low - prevClose)));
    }
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  // ── Swing highs/lows ──────────────────────────────────────────────────────

  private isSwingHigh(candles: OHLCV[], i: number, lookback: number): boolean {
    if (i < lookback || i >= candles.length - lookback) return false;
    const pivot = candles[i].high;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j].high >= pivot) return false;
    }
    return true;
  }

  private isSwingLow(candles: OHLCV[], i: number, lookback: number): boolean {
    if (i < lookback || i >= candles.length - lookback) return false;
    const pivot = candles[i].low;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j].low <= pivot) return false;
    }
    return true;
  }

  private detectSwings(candles: OHLCV[], lookback: number): { highs: number[]; lows: number[] } {
    const highs: number[] = [];
    const lows: number[] = [];
    for (let i = lookback; i < candles.length - lookback; i++) {
      if (this.isSwingHigh(candles, i, lookback)) highs.push(i);
      if (this.isSwingLow(candles, i, lookback)) lows.push(i);
    }
    return { highs, lows };
  }

  // ── Trend ────────────────────────────────────────────────────────────────────

  detectTrend(candles: OHLCV[], lookback: number): TrendDirection {
    const { highs, lows } = this.detectSwings(candles, lookback);
    if (highs.length < 2 || lows.length < 2) return 'consolidation';

    const lastTwoHighs = highs.slice(-2);
    const lastTwoLows = lows.slice(-2);

    const hhhl = candles[lastTwoHighs[1]].high > candles[lastTwoHighs[0]].high
      && candles[lastTwoLows[1]].low > candles[lastTwoLows[0]].low;

    const lhll = candles[lastTwoHighs[1]].high < candles[lastTwoHighs[0]].high
      && candles[lastTwoLows[1]].low < candles[lastTwoLows[0]].low;

    if (hhhl) return 'uptrend';
    if (lhll) return 'downtrend';
    return 'consolidation';
  }

  // ── Break of Structure ────────────────────────────────────────────────────

  detectLastBOS(candles: OHLCV[], lookback: number): StructureBreak | null {
    const { highs, lows } = this.detectSwings(candles, lookback);

    let lastBOS: StructureBreak | null = null;

    const volRatio = (idx: number) => {
      const avg = candles.slice(Math.max(0, idx - 20), idx).reduce((s, c) => s + c.volume, 0) / 20;
      return avg > 0 ? candles[idx].volume / avg : 1;
    };

    // Scan for bullish BOS: close breaks above prior swing high
    for (let i = 1; i < highs.length; i++) {
      const priorHighLevel = candles[highs[i - 1]].high;
      for (let j = highs[i - 1] + 1; j < candles.length; j++) {
        if (candles[j].close > priorHighLevel) {
          lastBOS = { direction: 'bullish', level: priorHighLevel, timestamp: candles[j].timestamp, volumeRatio: volRatio(j) };
          break;
        }
      }
    }

    // Scan for bearish BOS: close breaks below prior swing low
    for (let i = 1; i < lows.length; i++) {
      const priorLowLevel = candles[lows[i - 1]].low;
      for (let j = lows[i - 1] + 1; j < candles.length; j++) {
        if (candles[j].close < priorLowLevel) {
          const candidate: StructureBreak = { direction: 'bearish', level: priorLowLevel, timestamp: candles[j].timestamp, volumeRatio: volRatio(j) };
          if (!lastBOS || candidate.timestamp > lastBOS.timestamp) lastBOS = candidate;
          break;
        }
      }
    }

    return lastBOS;
  }

  // ── Change of Character ───────────────────────────────────────────────────

  detectCHoCH(candles: OHLCV[], lookback: number, trend: TrendDirection): StructureBreak | null {
    if (trend === 'consolidation') return null;
    const { highs, lows } = this.detectSwings(candles, lookback);

    if (trend === 'uptrend' && lows.length >= 2) {
      // CHoCH in uptrend: close breaks below most recent swing low
      const lastLowIdx = lows[lows.length - 1];
      const lastLowLevel = candles[lastLowIdx].low;
      for (let i = lastLowIdx + 1; i < candles.length; i++) {
        if (candles[i].close < lastLowLevel) {
          return { direction: 'bearish', level: lastLowLevel, timestamp: candles[i].timestamp };
        }
      }
    }

    if (trend === 'downtrend' && highs.length >= 2) {
      // CHoCH in downtrend: close breaks above most recent swing high
      const lastHighIdx = highs[highs.length - 1];
      const lastHighLevel = candles[lastHighIdx].high;
      for (let i = lastHighIdx + 1; i < candles.length; i++) {
        if (candles[i].close > lastHighLevel) {
          return { direction: 'bullish', level: lastHighLevel, timestamp: candles[i].timestamp };
        }
      }
    }

    return null;
  }

  // ── Order Blocks (Demand / Supply Zones) ─────────────────────────────────

  detectDemandZone(candles: OHLCV[], lookback: number): Zone | null {
    const { lows } = this.detectSwings(candles, lookback);
    if (lows.length === 0) return null;

    const swingLowIdx = lows[lows.length - 1];
    let orderBlockIdx = -1;
    for (let i = swingLowIdx; i >= Math.max(0, swingLowIdx - 5); i--) {
      if (candles[i].close < candles[i].open) {
        orderBlockIdx = i;
        break;
      }
    }
    if (orderBlockIdx === -1) orderBlockIdx = swingLowIdx;

    const ob = candles[orderBlockIdx];
    const rangeSize = ob.high - ob.low;
    const avgRange = this.computeATR(candles);
    const volAvg = candles.slice(Math.max(0, orderBlockIdx - 20), orderBlockIdx).reduce((s, c) => s + c.volume, 0) / 20;
    const volumeRatio = volAvg > 0 ? ob.volume / volAvg : 1;
    // Strong if: large candle OR high volume (institutional participation)
    const strength = (rangeSize > avgRange * 1.5 || volumeRatio > 1.5) ? 'strong' : 'moderate';

    return { high: ob.high, low: ob.low, strength, formedAt: ob.timestamp, volumeRatio };
  }

  detectSupplyZone(candles: OHLCV[], lookback: number): Zone | null {
    const { highs } = this.detectSwings(candles, lookback);
    if (highs.length === 0) return null;

    const swingHighIdx = highs[highs.length - 1];
    let orderBlockIdx = -1;
    for (let i = swingHighIdx; i >= Math.max(0, swingHighIdx - 5); i--) {
      if (candles[i].close > candles[i].open) {
        orderBlockIdx = i;
        break;
      }
    }
    if (orderBlockIdx === -1) orderBlockIdx = swingHighIdx;

    const ob = candles[orderBlockIdx];
    const rangeSize = ob.high - ob.low;
    const avgRange = this.computeATR(candles);
    const volAvg = candles.slice(Math.max(0, orderBlockIdx - 20), orderBlockIdx).reduce((s, c) => s + c.volume, 0) / 20;
    const volumeRatio = volAvg > 0 ? ob.volume / volAvg : 1;
    const strength = (rangeSize > avgRange * 1.5 || volumeRatio > 1.5) ? 'strong' : 'moderate';

    return { high: ob.high, low: ob.low, strength, formedAt: ob.timestamp, volumeRatio };
  }

  // ── Imbalances (Fair Value Gaps) ─────────────────────────────────────────

  detectOpenImbalance(candles: OHLCV[]): Imbalance | null {
    // Scan from most recent backward, return first unfilled imbalance
    for (let i = candles.length - 3; i >= 1; i--) {
      const [c1, , c3] = [candles[i], candles[i + 1], candles[i + 2]];
      const bullImb = c3.low > c1.high;
      const bearImb = c3.high < c1.low;

      if (bullImb) {
        const filled = candles.slice(i + 3).some(c => c.low <= c1.high);
        if (!filled) return { top: c3.low, bottom: c1.high, direction: 'bullish', timestamp: candles[i + 1].timestamp };
      }
      if (bearImb) {
        const filled = candles.slice(i + 3).some(c => c.high >= c1.low);
        if (!filled) return { top: c1.low, bottom: c3.high, direction: 'bearish', timestamp: candles[i + 1].timestamp };
      }
    }
    return null;
  }

  // ── Volume ────────────────────────────────────────────────────────────────

  computeRelativeVolume(candles: OHLCV[], period = 20): number {
    if (candles.length < period + 1) return 1;
    // Filter out zero-volume candles (common in FX Yahoo data for recent bars)
    const window = candles.slice(-period - 1, -1).filter(c => c.volume > 0);
    if (window.length < 5) return 1; // not enough real volume data
    const avg = window.reduce((s, c) => s + c.volume, 0) / window.length;
    if (avg === 0) return 1;
    // Find last candle with real volume (recent bars may be 0)
    const lastWithVolume = [...candles].reverse().find(c => c.volume > 0);
    if (!lastWithVolume) return 1;
    const ratio = lastWithVolume.volume / avg;
    return isFinite(ratio) ? ratio : 1;
  }

  computeVolumeProfile(candles: OHLCV[]): VolumeProfile | null {
    if (candles.length < 6) return null;
    const relativeVolume = this.computeRelativeVolume(candles);
    const volumeSpike = relativeVolume > 2.0;

    const n = Math.min(candles.length, 20);
    const recent = candles.slice(-n).filter(c => c.volume > 0);
    const last5 = candles.slice(-5).filter(c => c.volume > 0);
    const avg5 = last5.length > 0 ? last5.reduce((s, c) => s + c.volume, 0) / last5.length : 0;
    const avg20 = recent.length > 0 ? recent.reduce((s, c) => s + c.volume, 0) / recent.length : 0;
    const trend = avg20 === 0 ? 'flat' : avg5 > avg20 * 1.1 ? 'rising' : avg5 < avg20 * 0.9 ? 'falling' : 'flat';

    // Profile shape: divide range into thirds, compare volume weight distribution
    // b-shape: most volume in lower third = long liquidation (mean reversion up incoming)
    // P-shape: most volume in upper third = short covering (mean reversion down incoming)
    const profileShape = this.detectProfileShape(recent);

    // LVN: bucket the price range, find thin volume areas
    const lvnLevels = this.detectLVN(recent, candles[candles.length - 1].close);

    return { relativeVolume, volumeSpike, trend, profileShape, lvnLevels };
  }

  private detectProfileShape(candles: OHLCV[]): VolumeProfile['profileShape'] {
    if (candles.length < 5) return 'unknown';
    const high = Math.max(...candles.map(c => c.high));
    const low = Math.min(...candles.map(c => c.low));
    const range = high - low;
    if (range === 0) return 'unknown';

    const third = range / 3;
    let volLower = 0, volMiddle = 0, volUpper = 0;

    for (const c of candles) {
      const midPrice = (c.high + c.low) / 2;
      const vol = c.volume || 1;
      if (midPrice < low + third) volLower += vol;
      else if (midPrice < low + 2 * third) volMiddle += vol;
      else volUpper += vol;
    }

    const total = volLower + volMiddle + volUpper || 1;
    const lowerPct = volLower / total;
    const upperPct = volUpper / total;

    // b-shape: heavy lower volume, light upper → long liquidation at lows, mean reversion up
    if (lowerPct > 0.5 && upperPct < 0.25) return 'b_shape';
    // P-shape: heavy upper volume, light lower → short covering at highs, mean reversion down
    if (upperPct > 0.5 && lowerPct < 0.25) return 'p_shape';
    return 'normal';
  }

  private detectLVN(candles: OHLCV[], currentPrice: number): Array<{ price: number; type: 'support' | 'resistance' }> {
    if (candles.length < 5) return [];
    const high = Math.max(...candles.map(c => c.high));
    const low = Math.min(...candles.map(c => c.low));
    const range = high - low;
    if (range === 0) return [];

    const BUCKETS = 10;
    const bucketSize = range / BUCKETS;
    const buckets = Array(BUCKETS).fill(0) as number[];

    for (const c of candles) {
      const bucketIdx = Math.min(Math.floor((((c.high + c.low) / 2) - low) / bucketSize), BUCKETS - 1);
      buckets[bucketIdx] += c.volume || 1;
    }

    const avgBucketVol = buckets.reduce((a, b) => a + b, 0) / BUCKETS;
    const lvns: Array<{ price: number; type: 'support' | 'resistance' }> = [];

    for (let i = 0; i < BUCKETS; i++) {
      if (buckets[i] < avgBucketVol * 0.4) { // less than 40% of avg = low volume node
        const lvnPrice = low + (i + 0.5) * bucketSize;
        lvns.push({
          price: lvnPrice,
          type: lvnPrice < currentPrice ? 'support' : 'resistance',
        });
      }
    }

    // Return closest 2 LVNs (one above, one below)
    const below = lvns.filter(l => l.type === 'support').sort((a, b) => b.price - a.price).slice(0, 1);
    const above = lvns.filter(l => l.type === 'resistance').sort((a, b) => a.price - b.price).slice(0, 1);
    return [...below, ...above];
  }

  // ── Equal Highs / Equal Lows ──────────────────────────────────────────────

  detectEqualHighs(candles: OHLCV[], lookback: number, tolerance = 0.001): number | null {
    const { highs } = this.detectSwings(candles, lookback);
    if (highs.length < 2) return null;
    const last = candles[highs[highs.length - 1]].high;
    const prev = candles[highs[highs.length - 2]].high;
    if (Math.abs(last - prev) / last < tolerance) return last;
    return null;
  }

  detectEqualLows(candles: OHLCV[], lookback: number, tolerance = 0.001): number | null {
    const { lows } = this.detectSwings(candles, lookback);
    if (lows.length < 2) return null;
    const last = candles[lows[lows.length - 1]].low;
    const prev = candles[lows[lows.length - 2]].low;
    if (Math.abs(last - prev) / last < tolerance) return last;
    return null;
  }

  // ── Momentum ──────────────────────────────────────────────────────────────

  detectMomentumBias(candles: OHLCV[], lookback = 5): MomentumBias {
    if (candles.length < lookback) return 'neutral';
    const recent = candles.slice(-lookback);
    const bullish = recent.filter(c => c.close > c.open).length;
    const bearish = recent.filter(c => c.close < c.open).length;
    if (bullish > bearish + 1) return 'bullish';
    if (bearish > bullish + 1) return 'bearish';
    return 'neutral';
  }

  classifyLastCandle(candles: OHLCV[]): CandleType {
    if (candles.length === 0) return 'doji';
    const c = candles[candles.length - 1];
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    if (range === 0) return 'doji';
    const bodyRatio = body / range;
    const bullish = c.close > c.open;

    if (bodyRatio < 0.2) return 'doji';
    if (bullish) return bodyRatio > 0.6 ? 'strong_bullish' : 'weak_bullish';
    return bodyRatio > 0.6 ? 'strong_bearish' : 'weak_bearish';
  }

  // ── Liquidity Sweep ───────────────────────────────────────────────────────
  // Price wicks past equal highs/lows then closes back inside = stop hunt complete

  detectLiquiditySweep(candles: OHLCV[], lookback: number): LiquiditySweep | null {
    if (candles.length < 4) return null;
    const { highs, lows } = this.detectSwings(candles, lookback);

    // Check recent candles for a wick-and-recover pattern
    for (let i = candles.length - 1; i >= Math.max(1, candles.length - 5); i--) {
      const c = candles[i];

      // Bearish sweep: wick above equal highs (BSL) then close back below
      if (highs.length >= 2) {
        const eqHighLevel = this.detectEqualHighs(candles.slice(0, i), lookback);
        if (eqHighLevel && c.high > eqHighLevel && c.close < eqHighLevel) {
          return { direction: 'bearish', level: eqHighLevel, timestamp: c.timestamp, recoveryCandles: candles.length - 1 - i };
        }
      }

      // Bullish sweep: wick below equal lows (SSL) then close back above
      if (lows.length >= 2) {
        const eqLowLevel = this.detectEqualLows(candles.slice(0, i), lookback);
        if (eqLowLevel && c.low < eqLowLevel && c.close > eqLowLevel) {
          return { direction: 'bullish', level: eqLowLevel, timestamp: c.timestamp, recoveryCandles: candles.length - 1 - i };
        }
      }
    }
    return null;
  }

  // ── Liquidity Flip ────────────────────────────────────────────────────────
  // BOS level being retested from correct side = institutional re-entry

  detectLiquidityFlip(candles: OHLCV[], bos: StructureBreak | null): LiquidityFlip | null {
    if (!bos || candles.length < 3) return null;
    const currentPrice = candles[candles.length - 1].close;
    const distancePct = Math.abs(currentPrice - bos.level) / bos.level * 100;

    // Flip is active when price is within 0.3% of the BOS level AND approaching from correct side
    const approaching = bos.direction === 'bullish'
      ? currentPrice >= bos.level * 0.997 && currentPrice <= bos.level * 1.005
      : currentPrice <= bos.level * 1.003 && currentPrice >= bos.level * 0.995;

    return {
      level: bos.level,
      direction: bos.direction,
      distancePct,
      isActive: approaching && distancePct < 0.3,
    };
  }

  // ── RSI (14) + Divergence ─────────────────────────────────────────────────
  // Divergence: price makes new extreme but RSI does not → momentum dying

  computeRSI(candles: OHLCV[], period = 14): RSIResult | null {
    if (candles.length < period * 2 + 1) return null;
    const closes = candles.map(c => c.close);

    // Wilder smoothed RSI
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;

    const rsiValues: number[] = [];
    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsiValues.push(100 - 100 / (1 + rs));
    }

    if (rsiValues.length < 5) return null;
    const currentRSI = rsiValues[rsiValues.length - 1];

    // Divergence: compare last 2 swing highs/lows in price vs RSI over last 20 bars
    const lookWindow = Math.min(20, rsiValues.length - 1);
    const priceSlice = closes.slice(-lookWindow);
    const rsiSlice = rsiValues.slice(-lookWindow);

    // Find swing extremes in price window (simple: first half vs second half)
    const half = Math.floor(lookWindow / 2);
    const priceFirstHalf = priceSlice.slice(0, half);
    const priceSecondHalf = priceSlice.slice(half);
    const rsiFirstHalf = rsiSlice.slice(0, half);
    const rsiSecondHalf = rsiSlice.slice(half);

    const priceEarlyHigh = Math.max(...priceFirstHalf);
    const priceLateHigh = Math.max(...priceSecondHalf);
    const priceEarlyLow = Math.min(...priceFirstHalf);
    const priceLateLow = Math.min(...priceSecondHalf);

    const rsiEarlyHigh = Math.max(...rsiFirstHalf);
    const rsiLateHigh = Math.max(...rsiSecondHalf);
    const rsiEarlyLow = Math.min(...rsiFirstHalf);
    const rsiLateLow = Math.min(...rsiSecondHalf);

    // Bearish divergence: price HH but RSI LH
    const priceMadeHigher = priceLateHigh > priceEarlyHigh * 1.001;
    const rsiMadeLower = rsiLateHigh < rsiEarlyHigh * 0.98;
    // Bullish divergence: price LL but RSI HL
    const priceMadeLower = priceLateLow < priceEarlyLow * 0.999;
    const rsiMadeHigher = rsiLateLow > rsiEarlyLow * 1.02;

    let divergence: RSIResult['divergence'] = 'none';
    let divergenceStrength: RSIResult['divergenceStrength'] = 'none';

    if (priceMadeHigher && rsiMadeLower) {
      divergence = 'bearish';
      const gap = ((rsiEarlyHigh - rsiLateHigh) / rsiEarlyHigh) * 100;
      divergenceStrength = gap > 5 ? 'strong' : 'moderate';
    } else if (priceMadeLower && rsiMadeHigher) {
      divergence = 'bullish';
      const gap = ((rsiLateLow - rsiEarlyLow) / rsiEarlyLow) * 100;
      divergenceStrength = Math.abs(gap) > 5 ? 'strong' : 'moderate';
    }

    return {
      value: Math.round(currentRSI * 10) / 10,
      divergence,
      divergenceStrength,
      overbought: currentRSI > 70,
      oversold: currentRSI < 30,
    };
  }

  // ── Donchian Channels (20) ────────────────────────────────────────────────
  // Breakout of 20-period high/low = market doing something new in a full month

  computeDonchian(candles: OHLCV[], period = 20): DonchianResult | null {
    if (candles.length < period + 1) return null;

    // Use all-but-last-candle for the channel (standard: current bar excluded)
    const channelCandles = candles.slice(-period - 1, -1);
    const upper = Math.max(...channelCandles.map(c => c.high));
    const lower = Math.min(...channelCandles.map(c => c.low));
    const mid = (upper + lower) / 2;
    const channelWidthPct = ((upper - lower) / mid) * 100;

    const current = candles[candles.length - 1];

    // Breakout: current close exits the channel
    let breakout: DonchianResult['breakout'] = 'none';
    let breakoutStrength: DonchianResult['breakoutStrength'] = 'none';

    if (current.close > upper) {
      breakout = 'bullish';
      // Strong if also the highest high of the whole window including current
      const prevUpper = Math.max(...candles.slice(-period - 5, -1).map(c => c.high));
      breakoutStrength = current.high > prevUpper ? 'strong' : 'moderate';
    } else if (current.close < lower) {
      breakout = 'bearish';
      const prevLower = Math.min(...candles.slice(-period - 5, -1).map(c => c.low));
      breakoutStrength = current.low < prevLower ? 'strong' : 'moderate';
    }

    return {
      upper: Math.round(upper * 100000) / 100000,
      lower: Math.round(lower * 100000) / 100000,
      mid: Math.round(mid * 100000) / 100000,
      breakout,
      breakoutStrength,
      channelWidthPct: Math.round(channelWidthPct * 100) / 100,
    };
  }

  // ── Bollinger Bands (20, 2σ) ──────────────────────────────────────────────
  // Measures volatility only — expansion = fire alarm, squeeze = coiled spring

  computeBollinger(candles: OHLCV[], period = 20, stdDevMultiplier = 2): BollingerResult | null {
    if (candles.length < period + 10) return null;

    const closes = candles.map(c => c.close);
    const slice = closes.slice(-period);
    const mid = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((s, c) => s + (c - mid) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);
    const upper = mid + stdDevMultiplier * stdDev;
    const lower = mid - stdDevMultiplier * stdDev;
    const bandwidth = ((upper - lower) / mid) * 100;
    const currentClose = closes[closes.length - 1];
    const percentB = stdDev === 0 ? 0.5 : (currentClose - lower) / (upper - lower);

    // Bandwidth history for squeeze/expansion detection (last 50 bars)
    const bwHistory: number[] = [];
    const histLen = Math.min(50, candles.length - period);
    for (let i = histLen; i >= 1; i--) {
      const s = closes.slice(-(period + i), -i);
      const m = s.reduce((a, b) => a + b, 0) / period;
      const v = s.reduce((acc, c) => acc + (c - m) ** 2, 0) / period;
      const sd = Math.sqrt(v);
      bwHistory.push(((m + 2 * sd - (m - 2 * sd)) / m) * 100);
    }
    bwHistory.sort((a, b) => a - b);
    const p20 = bwHistory[Math.floor(bwHistory.length * 0.2)] ?? bandwidth;
    const p80 = bwHistory[Math.floor(bwHistory.length * 0.8)] ?? bandwidth;

    // Walking the band: last 3 closes all above upper or all below lower
    const last3 = closes.slice(-3);
    const walkingUpperBand = last3.every(c => c > upper);
    const walkingLowerBand = last3.every(c => c < lower);

    return {
      upper: Math.round(upper * 100000) / 100000,
      mid: Math.round(mid * 100000) / 100000,
      lower: Math.round(lower * 100000) / 100000,
      bandwidth: Math.round(bandwidth * 100) / 100,
      percentB: Math.round(percentB * 1000) / 1000,
      squeeze: bandwidth < p20,
      expansion: bandwidth > p80,
      walkingUpperBand,
      walkingLowerBand,
    };
  }

  // ── Full TF Analysis ─────────────────────────────────────────────────────

  analyzeTimeframe(candles: OHLCV[], lookback: number): TimeframeAnalysis {
    const trend = this.detectTrend(candles, lookback);
    const lastBOS = this.detectLastBOS(candles, lookback);
    return {
      trend,
      lastBOS,
      choch: this.detectCHoCH(candles, lookback, trend),
      demandZone: this.detectDemandZone(candles, lookback),
      supplyZone: this.detectSupplyZone(candles, lookback),
      openImbalance: this.detectOpenImbalance(candles),
      equalHighs: this.detectEqualHighs(candles, lookback),
      equalLows: this.detectEqualLows(candles, lookback),
      atr14: this.computeATR(candles),
      momentumBias: this.detectMomentumBias(candles),
      lastCandleType: this.classifyLastCandle(candles),
      volumeProfile: this.computeVolumeProfile(candles),
      liquiditySweep: this.detectLiquiditySweep(candles, lookback),
      liquidityFlip: this.detectLiquidityFlip(candles, lastBOS),
      rsi: this.computeRSI(candles),
      donchian: this.computeDonchian(candles),
      bollinger: this.computeBollinger(candles),
    };
  }

  // ── Alignment Score ───────────────────────────────────────────────────────

  computeAlignment(tfs: Record<string, TimeframeAnalysis>): AlignmentResult {
    const bullish: string[] = [];
    const bearish: string[] = [];

    for (const [tf, analysis] of Object.entries(tfs)) {
      if (analysis.trend === 'uptrend') bullish.push(tf);
      else if (analysis.trend === 'downtrend') bearish.push(tf);
    }

    const score = Math.max(bullish.length, bearish.length);
    return { score, maxScore: 4, bullish, bearish };
  }

  // ── Price vs Zones ────────────────────────────────────────────────────────

  computePriceVsZones(price: number, daily: TimeframeAnalysis): PriceVsZones {
    const demand = daily.demandZone;
    const supply = daily.supplyZone;

    const insideDemand = demand ? price >= demand.low && price <= demand.high : false;
    const insideSupply = supply ? price >= supply.low && price <= supply.high : false;

    const distanceToDemandPct = demand
      ? Math.abs(price - demand.high) / price * 100
      : 999;

    const distanceToSupplyPct = supply
      ? Math.abs(supply.low - price) / price * 100
      : 999;

    return { insideDemand, insideSupply, distanceToDemandPct, distanceToSupplyPct };
  }
}
