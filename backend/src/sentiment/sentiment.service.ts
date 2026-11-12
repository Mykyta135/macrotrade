import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CacheService } from '../common/cache.service';
import { CotService, CotPosition } from '../cot/cot.service';
import { DataHealthService } from '../common/data-health.service';

export interface PairSentiment {
  symbol: string;
  longPct: number;
  shortPct: number;
  longPositions: number;
  shortPositions: number;
  signal: 'fade-shorts' | 'fade-longs' | 'neutral';
  signalStrength: 'strong' | 'moderate' | 'weak';
  interpretation: string;
}

export interface FearGreedData {
  value: number;
  classification: string;
  riskBias: 'risk-on' | 'risk-off' | 'neutral';
}

export interface SentimentData {
  pairs: PairSentiment[];
  fearGreed: FearGreedData | null;
  fetchedAt: string;
  source: string;
}

const TRACKED_PAIRS = [
  'EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD',
  'USDJPY', 'USDCHF', 'USDCAD', 'GBPJPY',
];

// Maps COT currency to which pairs it affects and whether it's the base or quote
const COT_TO_PAIRS: Record<string, { symbol: string; cotIsBase: boolean }[]> = {
  EUR: [{ symbol: 'EURUSD', cotIsBase: true }],
  GBP: [{ symbol: 'GBPUSD', cotIsBase: true }, { symbol: 'GBPJPY', cotIsBase: true }],
  AUD: [{ symbol: 'AUDUSD', cotIsBase: true }],
  NZD: [{ symbol: 'NZDUSD', cotIsBase: true }],
  JPY: [{ symbol: 'USDJPY', cotIsBase: false }, { symbol: 'GBPJPY', cotIsBase: false }],
  CHF: [{ symbol: 'USDCHF', cotIsBase: false }],
  CAD: [{ symbol: 'USDCAD', cotIsBase: false }],
};

const CACHE_TTL = 15 * 60;

@Injectable()
export class SentimentService {
  private readonly logger = new Logger(SentimentService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly cotService: CotService,
    private readonly health: DataHealthService,
  ) {}

  async getSentimentData(_session?: string): Promise<SentimentData> {
    const cached = this.cache.get<SentimentData>('sentiment');
    if (cached) return cached;

    const [fearGreed, cotData] = await Promise.all([
      this.fetchFearGreed(),
      this.cotService.getCotData().catch(() => null),
    ]);

    const pairs = this.derivePairsFromCot(cotData?.positions ?? [], fearGreed);

    const result: SentimentData = {
      pairs,
      fearGreed,
      fetchedAt: new Date().toISOString(),
      source: 'CFTC non-reportable positions (реальний роздріб) + Fear & Greed Index (alternative.me)',
    };

    this.validate(result);

    this.cache.set('sentiment', result, CACHE_TTL);
    return result;
  }

  /**
   * Перевіряє, що настрої спираються на реальні позиції, а не на похідні.
   *
   * Ознака справжніх даних — ненульові longPositions/shortPositions (кількість
   * контрактів незвітних трейдерів). Нулі означали б, що джерело `nonrept`
   * зникло і фактор знову рахує похідні від COT — тобто подвійний рахунок.
   */
  private validate(d: SentimentData): void {
    this.health.clearSource('sentiment');

    const noRealVolume =
      d.pairs.length > 0 &&
      d.pairs.every((p) => (p.longPositions ?? 0) === 0 && (p.shortPositions ?? 0) === 0);

    if (noRealVolume) {
      this.health.report({
        source: 'sentiment',
        state: 'degraded',
        message:
          'Немає реальних обсягів роздрібу (nonrept із CFTC порожні) — фактор ' +
          '"Retail Sentiment" (2 бали з 5) втратив незалежне джерело.',
        affects: d.pairs.map((p) =>
          p.symbol.length === 6 ? `${p.symbol.slice(0, 3)}/${p.symbol.slice(3)}` : p.symbol,
        ),
      });
    }

    if (!d.pairs.length) {
      this.health.report({
        source: 'sentiment',
        state: 'broken',
        message: 'Немає даних настроїв — фактор Retail Sentiment дає 0 балів усім парам.',
      });
    }
  }

  private async fetchFearGreed(): Promise<FearGreedData | null> {
    try {
      const { data } = await axios.get('https://api.alternative.me/fng/?limit=1', { timeout: 8000 });
      const entry = data?.data?.[0];
      if (!entry) return null;

      const value = parseInt(entry.value, 10);
      const classification = entry.value_classification as string;

      const riskBias: 'risk-on' | 'risk-off' | 'neutral' =
        value >= 60 ? 'risk-on' :
        value <= 40 ? 'risk-off' : 'neutral';

      return { value, classification, riskBias };
    } catch (err) {
      this.logger.warn(`Fear & Greed fetch failed: ${(err as any).message}`);
      return null;
    }
  }

  // Retail positioning is statistically inverse to institutional (COT non-commercial).
  // When hedge funds are net long a currency, retail crowd tends to be net short.
  /**
   * Будує настрої роздрібу з НЕЗВІТНИХ позицій CFTC (`nonrept_*`).
   *
   * ЧОМУ САМЕ ЦЕ ДЖЕРЕЛО (досліджено 2026-07-21):
   * Myfxbook закрився за Cloudflare (403), Dukascopy/FXCM/IG/CBOE — теж 403,
   * OANDA недоступна в Україні. Єдине робоче джерело реальних позицій роздрібу
   * без ключа й регіональних обмежень — поля `nonrept` у звіті CFTC, який
   * система вже тягне для COT.
   *
   * Незвітні = трейдери надто дрібні для вимоги звітності, тобто роздріб.
   * Це НЕЗАЛЕЖНИЙ зріз, а не похідна від `noncomm`. Перевірено на живих даних:
   *   AUD: фонди 41% long / роздріб 67% long   ← протилежні
   *   EUR: фонди 49% long / роздріб 59% long   ← протилежні
   * Роздріб систематично довший за фонди — саме та поведінка, проти якої
   * будується контраріанська стратегія.
   *
   * БУЛО ДО ЦЬОГО: retailLongPct = 100 - institutionalLongPct, тобто настрої
   * просто інвертувались із COT. Це давало 2 бали з 5 на основі тих самих
   * даних, які вже оцінені фактором COT — подвійний рахунок.
   *
   * Обмеження: тижнева затримка (як у COT) і ф'ючерси CME, а не спот.
   */
  private derivePairsFromCot(
    positions: CotPosition[],
    fearGreed: FearGreedData | null,
  ): PairSentiment[] {
    const cotByCurrency = new Map(positions.map((p) => [p.currency, p]));
    const pairMap = new Map<
      string,
      { longPct: number; shortPct: number; votes: number; longPos: number; shortPos: number }
    >();

    for (const [currency, mappings] of Object.entries(COT_TO_PAIRS)) {
      const cot = cotByCurrency.get(currency);
      if (!cot) continue;

      const retailLong = cot.nonReportableLong ?? 0;
      const retailShort = cot.nonReportableShort ?? 0;
      const total = retailLong + retailShort;
      if (total <= 0) continue;   // немає даних роздрібу — пропускаємо валюту

      // Реальний відсоток лонгів роздрібу по цій валюті
      const retailLongPct = (retailLong / total) * 100;

      for (const { symbol, cotIsBase } of mappings) {
        const existing = pairMap.get(symbol)
          ?? { longPct: 0, shortPct: 0, votes: 0, longPos: 0, shortPos: 0 };
        // Якщо валюта CFTC — котирувальна (JPY в USD/JPY), позиція по парі протилежна
        const adjustedLong = cotIsBase ? retailLongPct : 100 - retailLongPct;
        pairMap.set(symbol, {
          longPct: existing.longPct + adjustedLong,
          shortPct: existing.shortPct + (100 - adjustedLong),
          votes: existing.votes + 1,
          longPos: existing.longPos + (cotIsBase ? retailLong : retailShort),
          shortPos: existing.shortPos + (cotIsBase ? retailShort : retailLong),
        });
      }
    }

    const results: PairSentiment[] = [];

    for (const symbol of TRACKED_PAIRS) {
      const entry = pairMap.get(symbol);
      if (!entry || entry.votes === 0) continue;

      let longPct = entry.longPct / entry.votes;
      let shortPct = entry.shortPct / entry.votes;

      // Fear & Greed adjustment: extreme fear boosts JPY/CHF/USD safe havens, hurts AUD/NZD
      if (fearGreed) {
        const isSafeHaven = symbol.includes('JPY') || symbol.includes('CHF');
        const isRiskOn = symbol.includes('AUD') || symbol.includes('NZD');
        if (fearGreed.riskBias === 'risk-off' && isSafeHaven) {
          longPct = Math.min(longPct + 8, 95);
          shortPct = 100 - longPct;
        } else if (fearGreed.riskBias === 'risk-off' && isRiskOn) {
          shortPct = Math.min(shortPct + 8, 95);
          longPct = 100 - shortPct;
        } else if (fearGreed.riskBias === 'risk-on' && isRiskOn) {
          longPct = Math.min(longPct + 5, 90);
          shortPct = 100 - longPct;
        }
      }

      results.push({
        symbol,
        longPct: Math.round(longPct),
        shortPct: Math.round(shortPct),
        // Реальні контракти незвітних трейдерів — раніше тут були нулі,
        // що й було ознакою відсутності справжніх даних
        longPositions: Math.round(entry.longPos / entry.votes),
        shortPositions: Math.round(entry.shortPos / entry.votes),
        ...this.classifySentiment(symbol, longPct, shortPct),
      });
    }

    return results;
  }

  private classifySentiment(
    symbol: string,
    longPct: number,
    shortPct: number,
  ): Pick<PairSentiment, 'signal' | 'signalStrength' | 'interpretation'> {
    if (shortPct >= 70) return { signal: 'fade-shorts', signalStrength: 'strong', interpretation: `${shortPct.toFixed(0)}% retail SHORT on ${symbol} (COT-derived) — crowd is trapped. Look to BUY.` };
    if (longPct >= 70)  return { signal: 'fade-longs',  signalStrength: 'strong', interpretation: `${longPct.toFixed(0)}% retail LONG on ${symbol} (COT-derived) — crowd is trapped. Look to SELL.` };
    if (shortPct >= 60) return { signal: 'fade-shorts', signalStrength: 'moderate', interpretation: `${shortPct.toFixed(0)}% retail SHORT (COT-derived) — moderate bearish crowd. Mild buy bias.` };
    if (longPct >= 60)  return { signal: 'fade-longs',  signalStrength: 'moderate', interpretation: `${longPct.toFixed(0)}% retail LONG (COT-derived) — moderate bullish crowd. Mild sell bias.` };
    return { signal: 'neutral', signalStrength: 'weak', interpretation: `${symbol} sentiment balanced (${longPct.toFixed(0)}% long / ${shortPct.toFixed(0)}% short). No crowd trap.` };
  }
}
