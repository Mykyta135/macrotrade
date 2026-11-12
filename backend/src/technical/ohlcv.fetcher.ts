import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OHLCV } from './technical.interfaces';

type Timeframe = 'weekly' | 'daily' | 'h4' | 'h1';

// Yahoo Finance interval strings
const YF_INTERVAL: Record<Timeframe, string> = {
  weekly: '1wk',
  daily: '1d',
  h4: '1h',  // Yahoo doesn't support 4h natively — fetch 1h and aggregate
  h1: '1h',
};

// Days of history to fetch
const TF_DAYS: Record<Timeframe, number> = {
  weekly: 365,   // ~52 weekly candles
  daily: 120,
  h4: 30,        // 30 days of 1h → enough for 120+ 4h candles after aggregation
  h1: 4,         // 4 days of 1h → ~72 candles
};

// Forex symbol format for Yahoo Finance
const toYahooSymbol = (pair: string) => pair.replace('/', '') + '=X';

@Injectable()
export class OhlcvFetcher implements OnModuleInit {
  private readonly logger = new Logger(OhlcvFetcher.name);
  private yf: any = null;

  async onModuleInit() {
    try {
      const mod = await import('yahoo-finance2');
      this.yf = new (mod.default as any)();
      this.logger.log('yahoo-finance2 initialized');
    } catch (err: any) {
      this.logger.error(`Failed to init yahoo-finance2: ${err.message}`);
    }
  }

  private aggregate1hTo4h(candles: OHLCV[]): OHLCV[] {
    const result: OHLCV[] = [];
    for (let i = 0; i + 3 < candles.length; i += 4) {
      const group = candles.slice(i, i + 4);
      result.push({
        timestamp: group[0].timestamp,
        open: group[0].open,
        high: Math.max(...group.map(c => c.high)),
        low: Math.min(...group.map(c => c.low)),
        close: group[group.length - 1].close,
        volume: group.reduce((s, c) => s + c.volume, 0),
      });
    }
    return result;
  }

  async fetchOHLCV(pair: string, timeframe: Timeframe): Promise<OHLCV[]> {
    if (!this.yf) throw new Error('yahoo-finance2 not initialized');

    const symbol = toYahooSymbol(pair);
    const interval = YF_INTERVAL[timeframe];
    const days = TF_DAYS[timeframe];
    const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await this.yf.chart(symbol, { interval, period1 });
    const quotes: any[] = result?.quotes ?? [];

    const candles: OHLCV[] = quotes
      .filter(q => q.open != null && q.close != null)
      .map(q => ({
        timestamp: new Date(q.date).getTime(),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume ?? 0,
      }));

    if (timeframe === 'h4') return this.aggregate1hTo4h(candles);
    // Drop in-progress weekly candle
    if (timeframe === 'weekly' && candles.length > 1) candles.pop();

    return candles;
  }

  async fetchAllTimeframes(pair: string): Promise<Record<Timeframe, OHLCV[]>> {
    const results = await Promise.allSettled([
      this.fetchOHLCV(pair, 'weekly'),
      this.fetchOHLCV(pair, 'daily'),
      this.fetchOHLCV(pair, 'h4'),
      this.fetchOHLCV(pair, 'h1'),
    ]);

    const tfs: Timeframe[] = ['weekly', 'daily', 'h4', 'h1'];
    const out: Partial<Record<Timeframe, OHLCV[]>> = {};

    for (let i = 0; i < tfs.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        out[tfs[i]] = r.value;
      } else {
        this.logger.warn(`fetchOHLCV ${pair} ${tfs[i]}: ${r.reason?.message}`);
        out[tfs[i]] = [];
      }
    }

    return out as Record<Timeframe, OHLCV[]>;
  }
}
