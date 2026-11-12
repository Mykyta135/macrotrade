import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import NodeCache from 'node-cache';
import { OhlcvFetcher } from './ohlcv.fetcher';
import { AnalysisService } from './analysis.service';
import { TechnicalContext, TechnicalReport, SessionLevels, StackedZone, OHLCV } from './technical.interfaces';
import { OhlcvCandle } from '../database/entities/ohlcv-candle.entity';
import { TechnicalSnapshot } from '../database/entities/technical-snapshot.entity';

const PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD',
  'NZD/USD', 'USD/CAD', 'USD/CHF', 'GBP/JPY',
];

const LOOKBACKS = { weekly: 2, daily: 3, h4: 3, h1: 2 };
const CACHE_TTL = 900;

@Injectable()
export class TechnicalService {
  private readonly logger = new Logger(TechnicalService.name);
  private readonly cache = new NodeCache({ stdTTL: CACHE_TTL });

  constructor(
    private readonly ohlcvFetcher: OhlcvFetcher,
    private readonly analysisService: AnalysisService,
    @InjectRepository(OhlcvCandle)
    private readonly ohlcvRepo: Repository<OhlcvCandle>,
    @InjectRepository(TechnicalSnapshot)
    private readonly snapshotRepo: Repository<TechnicalSnapshot>,
  ) {}

  private async persistCandles(pair: string, tfCandles: Record<string, any[]>): Promise<void> {
    const tfs = ['weekly', 'daily', 'h4', 'h1'];
    for (const tf of tfs) {
      const candles = tfCandles[tf] ?? [];
      if (candles.length === 0) continue;
      const entities = candles.map(c => ({
        pair, timeframe: tf,
        timestamp: c.timestamp,
        open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
      }));
      await this.ohlcvRepo
        .createQueryBuilder()
        .insert()
        .into(OhlcvCandle)
        .values(entities)
        .orIgnore()
        .execute();
    }
  }

  private async persistSnapshot(result: TechnicalContext): Promise<void> {
    if (!result.timeframes) return;
    const { daily } = result.timeframes;
    const snapshot = this.snapshotRepo.create({
      pair: result.pair,
      trendWeekly: result.timeframes.weekly.trend,
      trendDaily: daily.trend,
      trendH4: result.timeframes.h4.trend,
      trendH1: result.timeframes.h1.trend,
      alignmentScore: result.alignment.score,
      insideDemand: result.priceVsZones.insideDemand,
      insideSupply: result.priceVsZones.insideSupply,
      atr14Daily: daily.atr14,
      demandZoneHigh: daily.demandZone?.high ?? undefined,
      demandZoneLow: daily.demandZone?.low ?? undefined,
      supplyZoneHigh: daily.supplyZone?.high ?? undefined,
      supplyZoneLow: daily.supplyZone?.low ?? undefined,
      equalHighs: daily.equalHighs ?? undefined,
      equalLows: daily.equalLows ?? undefined,
      lastBosDirection: daily.lastBOS?.direction ?? undefined,
      chochDirection: daily.choch?.direction ?? undefined,
      rawJson: result as any,
    });
    await this.snapshotRepo.save(snapshot);
  }

  async analyzePair(pair: string, forceRefresh = false): Promise<TechnicalContext> {
    const cacheKey = `tech_${pair}`;
    if (!forceRefresh) {
      const cached = this.cache.get<TechnicalContext>(cacheKey);
      if (cached) return cached;
    }

    try {
      const tfCandles = await this.ohlcvFetcher.fetchAllTimeframes(pair);

      // Persist raw candles for ML training
      this.persistCandles(pair, tfCandles).catch(e =>
        this.logger.warn(`Candle persist failed for ${pair}: ${e.message}`),
      );

      const weekly = this.analysisService.analyzeTimeframe(tfCandles.weekly, LOOKBACKS.weekly);
      const daily = this.analysisService.analyzeTimeframe(tfCandles.daily, LOOKBACKS.daily);
      const h4 = this.analysisService.analyzeTimeframe(tfCandles.h4, LOOKBACKS.h4);
      const h1 = this.analysisService.analyzeTimeframe(tfCandles.h1, LOOKBACKS.h1);

      const timeframes = { weekly, daily, h4, h1 };
      const alignment = this.analysisService.computeAlignment(timeframes);
      const currentPrice = tfCandles.h1.length > 0
        ? tfCandles.h1[tfCandles.h1.length - 1].close
        : 0;
      const priceVsZones = this.analysisService.computePriceVsZones(currentPrice, daily);
      const sessionLevels = this.computeSessionLevels(tfCandles.h1, currentPrice);
      const stackedZones = this.computeStackedZones(daily, currentPrice);

      const result: TechnicalContext = {
        pair,
        fetchedAt: new Date().toISOString(),
        timeframes,
        alignment,
        currentPrice,
        priceVsZones,
        sessionLevels,
        stackedZones,
      };

      // Persist snapshot async (non-blocking)
      this.persistSnapshot(result).catch(e =>
        this.logger.warn(`Snapshot persist failed for ${pair}: ${e.message}`),
      );

      this.cache.set(cacheKey, result);
      return result;
    } catch (err: any) {
      this.logger.warn(`Failed to analyze ${pair}: ${err.message}`);
      return {
        pair,
        fetchedAt: new Date().toISOString(),
        timeframes: null as any,
        alignment: { score: 0, maxScore: 4, bullish: [], bearish: [] },
        currentPrice: 0,
        priceVsZones: { insideDemand: false, insideSupply: false, distanceToDemandPct: 999, distanceToSupplyPct: 999 },
        sessionLevels: null,
        stackedZones: [],
        dataUnavailable: true,
        error: err.message,
      };
    }
  }

  // ── Session H/L — BSL/SSL institutional liquidity targets ─────────────────
  // H1 candles are used to identify previous session highs/lows

  private computeSessionLevels(h1Candles: OHLCV[], currentPrice: number): SessionLevels | null {
    if (h1Candles.length < 8) return null;

    const now = new Date();
    const utcHour = now.getUTCHours();

    // Group candles by session window (UTC)
    const getSessionCandles = (startHour: number, endHour: number, lookbackDays = 1) => {
      const cutoffMs = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
      return h1Candles.filter(c => {
        const d = new Date(c.timestamp);
        const h = d.getUTCHours();
        const inWindow = startHour < endHour
          ? h >= startHour && h < endHour
          : h >= startHour || h < endHour;
        // Only previous session (not current)
        const isPast = c.timestamp < cutoffMs + 24 * 60 * 60 * 1000;
        return inWindow && isPast;
      });
    };

    const asiaCandles = getSessionCandles(0, 8);
    const londonCandles = getSessionCandles(8, 12);

    const sessionHigh = (cs: OHLCV[]) => cs.length ? Math.max(...cs.map(c => c.high)) : null;
    const sessionLow = (cs: OHLCV[]) => cs.length ? Math.min(...cs.map(c => c.low)) : null;

    // Previous day high/low from daily candle (second-to-last in daily)
    const prevDayHigh = h1Candles.slice(-48, -24).length
      ? Math.max(...h1Candles.slice(-48, -24).map(c => c.high))
      : null;
    const prevDayLow = h1Candles.slice(-48, -24).length
      ? Math.min(...h1Candles.slice(-48, -24).map(c => c.low))
      : null;

    const asiaHigh = sessionHigh(asiaCandles);
    const asiaLow = sessionLow(asiaCandles);
    const londonHigh = sessionHigh(londonCandles);
    const londonLow = sessionLow(londonCandles);

    // Collect all BSL (above price) and SSL (below price) levels
    const bslLevels = [asiaHigh, londonHigh, prevDayHigh].filter((v): v is number => v !== null && v > currentPrice);
    const sslLevels = [asiaLow, londonLow, prevDayLow].filter((v): v is number => v !== null && v < currentPrice);

    const nearestBSL = bslLevels.length ? Math.min(...bslLevels) : null;
    const nearestSSL = sslLevels.length ? Math.max(...sslLevels) : null;

    return {
      asiaHigh,
      asiaLow,
      londonHigh,
      londonLow,
      prevDayHigh,
      prevDayLow,
      nearestBSL,
      nearestSSL,
      distanceToBSLPct: nearestBSL ? (nearestBSL - currentPrice) / currentPrice * 100 : null,
      distanceToSSLPct: nearestSSL ? (currentPrice - nearestSSL) / currentPrice * 100 : null,
    };
  }

  // ── Stacked Zone Scoring — confluence of demand/supply + BOS + imbalance ──

  private computeStackedZones(daily: any, currentPrice: number): StackedZone[] {
    if (!daily) return [];
    const zones: StackedZone[] = [];
    const TOLERANCE = 0.005; // 0.5% proximity threshold

    const near = (a: number, b: number) => Math.abs(a - b) / b < TOLERANCE;
    const midZone = (z: { high: number; low: number }) => (z.high + z.low) / 2;

    // Check demand zone confluence
    if (daily.demandZone) {
      const dMid = midZone(daily.demandZone);
      const components: string[] = ['Demand Zone'];
      let score = 1;

      if (daily.lastBOS && near(daily.lastBOS.level, dMid)) { components.push('BOS Level'); score++; }
      if (daily.openImbalance && near(midZone(daily.openImbalance), dMid)) { components.push('Imbalance'); score++; }

      if (score >= 2) zones.push({ price: dMid, score, components, direction: 'demand' });
    }

    // Check supply zone confluence
    if (daily.supplyZone) {
      const sMid = midZone(daily.supplyZone);
      const components: string[] = ['Supply Zone'];
      let score = 1;

      if (daily.lastBOS && near(daily.lastBOS.level, sMid)) { components.push('BOS Level'); score++; }
      if (daily.openImbalance && near(midZone(daily.openImbalance), sMid)) { components.push('Imbalance'); score++; }

      if (score >= 2) zones.push({ price: sMid, score, components, direction: 'supply' });
    }

    return zones;
  }

  async analyzeAll(forceRefresh = false): Promise<TechnicalReport> {
    const results = await Promise.all(
      PAIRS.map(pair => this.analyzePair(pair, forceRefresh)),
    );
    return { generatedAt: new Date().toISOString(), pairs: results };
  }
}
