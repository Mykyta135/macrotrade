import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { CacheService } from '../common/cache.service';

export type FuturesQuality = 'institutional' | 'covering_only' | 'liquidation_only' | 'neutral';

export interface FuturesConfirmation {
  // 'institutional': new money entering — trend has real fuel
  // 'covering_only': rally/sell-off driven by short/long covering, not new positions — low quality
  // 'liquidation_only': move driven by stop-outs, not conviction
  // 'neutral': no clear read
  quality: FuturesQuality;
  oiChange: number;          // week-on-week OI change in contracts
  oiChangePct: number;       // percentage OI change
  newLongsAdded: number;     // change in noncomm long positions
  newShortsAdded: number;    // change in noncomm short positions (negative = shorts closing)
  implication: string;
}

export interface CotPosition {
  currency: string;
  pair: string;
  nonCommercialLong: number;
  nonCommercialShort: number;
  openInterest: number;
  prevOpenInterest: number;
  netPosition: number;
  prevNetPosition: number;
  weeklyChange: number;
  // Velocity: net change over 3 weeks (rapid accumulation = exhaustion signal)
  velocity3w: number;
  // OI divergence: price rising + OI falling + specs max long = squeeze not real buying
  oiDivergence: 'bullish_exhaustion' | 'bearish_exhaustion' | 'none';
  // Liquidation cascade setup: specs crowded + OI diverging + structure break incoming
  specsLiquidationRisk: 'high' | 'moderate' | 'low';
  // CME futures quality filter: new money vs covering/liquidation
  futuresConfirmation: FuturesConfirmation;
  // ── Незвітні позиції = РОЗДРІБ ────────────────────────────────────────────
  // Трейдери надто дрібні, щоб підпадати під вимогу звітності CFTC. Це
  // НЕЗАЛЕЖНИЙ від noncomm зріз: роздріб систематично стоїть проти фондів
  // (перевірено 2026-07-21: AUD фонди 41% long / роздріб 67% long).
  // Використовується в SentimentService замість недоступного Myfxbook.
  nonReportableLong: number;
  nonReportableShort: number;
  bias: 'bullish' | 'bearish' | 'neutral';
  signal: string;
  reportDate: string;
  // Rolling history for percentile calculation (most recent 52 weeks)
  netHistory: number[];
}

export interface CotData {
  positions: CotPosition[];
  fetchedAt: string;
  source: string;
  note: string;
}

// CFTC contract market codes for major currencies (futures-only legacy report)
const COT_CODES: Record<string, { currency: string; pair: string }> = {
  '099741': { currency: 'EUR', pair: 'EUR/USD' },
  '096742': { currency: 'GBP', pair: 'GBP/USD' },
  '097741': { currency: 'JPY', pair: 'USD/JPY' },
  '092741': { currency: 'CHF', pair: 'USD/CHF' },
  '232741': { currency: 'CAD', pair: 'USD/CAD' },
  '112741': { currency: 'AUD', pair: 'AUD/USD' },
  '102741': { currency: 'NZD', pair: 'NZD/USD' },
};

// CFTC public SODA API — no key required
const CFTC_BASE = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';

// COT is published every Friday at ~3:30 PM ET.
// Returns seconds until next Friday 3:30 PM ET from now.
function secondsUntilNextCotRelease(): number {
  const now = new Date();
  // Work in ET (UTC-4 in summer, UTC-5 in winter — approximate with UTC-4)
  const etOffset = -4 * 60;
  const etNow = new Date(now.getTime() + (etOffset - now.getTimezoneOffset()) * 60000);

  const day = etNow.getDay(); // 0=Sun, 5=Fri
  const daysUntilFriday = (5 - day + 7) % 7 || 7; // always at least push to next Friday

  const target = new Date(etNow);
  target.setDate(etNow.getDate() + daysUntilFriday);
  target.setHours(15, 30, 0, 0); // 3:30 PM ET

  // If it's Friday before 3:30 PM ET, release is today
  if (day === 5 && etNow < target) {
    target.setDate(etNow.getDate());
    target.setHours(15, 30, 0, 0);
  }

  return Math.max(Math.round((target.getTime() - etNow.getTime()) / 1000), 3600);
}

@Injectable()
export class CotService {
  constructor(private readonly cache: CacheService) {}

  async getCotData(): Promise<CotData> {
    const cached = this.cache.get<CotData>('cot');
    if (cached) return cached;

    const positions = (
      await Promise.all(
        Object.entries(COT_CODES).map(([code, meta]) =>
          this.fetchCotForCode(code, meta),
        ),
      )
    ).filter((p): p is CotPosition => p !== null);

    const result: CotData = {
      positions,
      fetchedAt: new Date().toISOString(),
      source: 'CFTC Public Reporting (publicreporting.cftc.gov)',
      note: 'Non-commercial (hedge fund) net positions. Updated each Friday.',
    };

    const ttl = secondsUntilNextCotRelease();
    this.cache.set('cot', result, ttl);
    return result;
  }

  private async fetchCotForCode(
    code: string,
    meta: { currency: string; pair: string },
  ): Promise<CotPosition | null> {
    try {
      // Fetch 52 weeks for velocity + percentile + OI divergence
      const url =
        `${CFTC_BASE}?$limit=52` +
        `&$where=cftc_contract_market_code='${code}'` +
        `&$order=report_date_as_yyyy_mm_dd DESC`;

      const { data } = await axios.get(url, { timeout: 15000 });
      if (!Array.isArray(data) || data.length < 4) return null;

      const parse = (row: any, field: string) => parseInt(row[field] ?? '0', 10);

      const latest = data[0];
      const nonCommercialLong = parse(latest, 'noncomm_positions_long_all');
      const nonCommercialShort = parse(latest, 'noncomm_positions_short_all');
      const openInterest = parse(latest, 'open_interest_all');
      const netPosition = nonCommercialLong - nonCommercialShort;

      // Роздріб (незвітні) — з того самого рядка, окремі поля
      const nonReportableLong = parse(latest, 'nonrept_positions_long_all');
      const nonReportableShort = parse(latest, 'nonrept_positions_short_all');

      const prev = data[1];
      const prevLong = parse(prev, 'noncomm_positions_long_all');
      const prevShort = parse(prev, 'noncomm_positions_short_all');
      const prevOpenInterest = parse(prev, 'open_interest_all');
      const prevNet = prevLong - prevShort;
      const weeklyChange = netPosition - prevNet;

      // CME futures quality: did the move come from new money or just covering?
      const oiChange = openInterest - prevOpenInterest;
      const oiChangePct = prevOpenInterest > 0 ? (oiChange / prevOpenInterest) * 100 : 0;
      const newLongsAdded = nonCommercialLong - prevLong;       // +ve = new longs entering
      const newShortsAdded = nonCommercialShort - parse(prev, 'noncomm_positions_short_all'); // +ve = new shorts entering

      const futuresConfirmation = this.computeFuturesQuality(oiChange, oiChangePct, newLongsAdded, newShortsAdded, weeklyChange);

      // 3-week velocity: change from 3 weeks ago to now
      const w3 = data[3];
      const w3Net = parse(w3, 'noncomm_positions_long_all') - parse(w3, 'noncomm_positions_short_all');
      const velocity3w = netPosition - w3Net;

      // Rolling net history for percentile (52 weeks, most recent first)
      const netHistory = data.map((row: any) =>
        parse(row, 'noncomm_positions_long_all') - parse(row, 'noncomm_positions_short_all'),
      );

      // COT percentile (current rank in 52-week history)
      const cotPercentile = this.computePercentile(netPosition, netHistory);

      // OI divergence detection
      // OI falling while specs remain crowded = squeeze/liquidation fuel, not real buying
      const oiDeclining = openInterest < prevOpenInterest * 0.99; // >1% OI drop
      const specsMaxLong = cotPercentile > 80;
      const specsMaxShort = cotPercentile < 20;
      let oiDivergence: CotPosition['oiDivergence'] = 'none';
      if (oiDeclining && specsMaxLong) oiDivergence = 'bullish_exhaustion';
      else if (!oiDeclining && specsMaxShort) oiDivergence = 'bearish_exhaustion';

      // Rapid velocity = crowding accelerating toward exhaustion
      const velocityPctOfHistory = Math.abs(velocity3w) / (Math.max(...netHistory.map(Math.abs)) || 1);
      const rapidAccumulation = velocityPctOfHistory > 0.15; // moved >15% of historical range in 3 weeks

      // Spec liquidation risk
      let specsLiquidationRisk: CotPosition['specsLiquidationRisk'] = 'low';
      if ((specsMaxLong || specsMaxShort) && oiDivergence !== 'none' && rapidAccumulation) {
        specsLiquidationRisk = 'high';
      } else if ((specsMaxLong || specsMaxShort) && rapidAccumulation) {
        specsLiquidationRisk = 'moderate';
      }

      return {
        currency: meta.currency,
        pair: meta.pair,
        nonCommercialLong,
        nonCommercialShort,
        openInterest,
        prevOpenInterest,
        netPosition,
        prevNetPosition: prevNet,
        weeklyChange,
        velocity3w,
        oiDivergence,
        specsLiquidationRisk,
        futuresConfirmation,
        nonReportableLong,
        nonReportableShort,
        bias: netPosition > 0 ? 'bullish' : netPosition < 0 ? 'bearish' : 'neutral',
        signal: this.buildCotSignal(netPosition, weeklyChange, velocity3w, oiDivergence, specsLiquidationRisk, cotPercentile, futuresConfirmation),
        reportDate: (latest.report_date_as_yyyy_mm_dd as string).slice(0, 10),
        netHistory,
      };
    } catch {
      return null;
    }
  }

  private computeFuturesQuality(
    oiChange: number,
    oiChangePct: number,
    newLongsAdded: number,
    newShortsAdded: number,
    weeklyNetChange: number,
  ): FuturesConfirmation {
    const netBullish = weeklyNetChange > 0; // specs net added longs this week

    let quality: FuturesQuality;
    let implication: string;

    if (netBullish) {
      if (oiChange > 0 && newLongsAdded > 0) {
        // Price bias bullish + OI rising + new longs entering = institutional conviction
        quality = 'institutional';
        implication = `Institutional quality: new money entering long (${newLongsAdded.toLocaleString()} new longs, OI +${oiChangePct.toFixed(1)}%). Real buying, not short-covering. High quality trend fuel.`;
      } else if (oiChange < 0 && newShortsAdded < 0) {
        // Bullish price move + OI falling + shorts closing = short covering only
        quality = 'covering_only';
        implication = `Low quality: bullish move driven by short-covering only (${Math.abs(newShortsAdded).toLocaleString()} shorts closed, OI ${oiChangePct.toFixed(1)}%). No new long money entering. Rally likely exhausted without fresh buyers.`;
      } else {
        quality = 'neutral';
        implication = `Mixed: OI change ${oiChangePct.toFixed(1)}% — no clear institutional vs covering signal.`;
      }
    } else {
      if (oiChange > 0 && newShortsAdded > 0) {
        // Bearish + OI rising + new shorts entering = institutional short conviction
        quality = 'institutional';
        implication = `Institutional quality: new money entering short (${newShortsAdded.toLocaleString()} new shorts, OI +${oiChangePct.toFixed(1)}%). Real selling conviction, not long liquidation. High quality downtrend fuel.`;
      } else if (oiChange < 0 && newLongsAdded < 0) {
        // Bearish move + OI falling + longs exiting = liquidation only
        quality = 'liquidation_only';
        implication = `Low quality: bearish move driven by long liquidation only (${Math.abs(newLongsAdded).toLocaleString()} longs closed, OI ${oiChangePct.toFixed(1)}%). No new short positions being built. Sell-off likely exhausted without fresh sellers.`;
      } else {
        quality = 'neutral';
        implication = `Mixed: OI change ${oiChangePct.toFixed(1)}% — no clear institutional vs liquidation signal.`;
      }
    }

    return { quality, oiChange, oiChangePct, newLongsAdded, newShortsAdded, implication };
  }

  private computePercentile(current: number, history: number[]): number {
    if (history.length === 0) return 50;
    const below = history.filter(v => v < current).length;
    return Math.round((below / history.length) * 100);
  }

  private buildCotSignal(
    net: number,
    change: number,
    velocity3w: number,
    oiDivergence: CotPosition['oiDivergence'],
    liquidationRisk: CotPosition['specsLiquidationRisk'],
    percentile: number,
    futures: FuturesConfirmation,
  ): string {
    const direction = net > 0 ? 'LONG' : 'SHORT';
    const momentum = Math.sign(change) === Math.sign(net) ? 'increasing' : 'reducing';
    const parts: string[] = [
      `Hedge funds net ${direction} ${Math.abs(net).toLocaleString()} contracts (${percentile}th pct), ${momentum} position.`,
    ];
    if (Math.abs(velocity3w) > 0) {
      parts.push(`3-week velocity: ${velocity3w > 0 ? '+' : ''}${velocity3w.toLocaleString()} contracts — ${Math.abs(velocity3w) > 20000 ? 'RAPID accumulation, exhaustion risk.' : 'moderate pace.'}`);
    }
    if (oiDivergence === 'bullish_exhaustion') {
      parts.push('OI DIVERGENCE: Open Interest falling while specs max long — rally fueled by short-squeeze, not new buying. Trend functionally exhausted.');
    } else if (oiDivergence === 'bearish_exhaustion') {
      parts.push('OI DIVERGENCE: Open Interest rising while specs max short — potential short-squeeze setup building.');
    }
    if (liquidationRisk === 'high') {
      parts.push('LIQUIDATION CASCADE RISK HIGH: Crowded positioning + OI divergence + rapid accumulation = multi-billion stop pool behind any structure break.');
    }
    // Futures quality filter
    if (futures.quality !== 'neutral') {
      parts.push(`FUTURES QUALITY: ${futures.implication}`);
    }
    return parts.join(' ');
  }
}
