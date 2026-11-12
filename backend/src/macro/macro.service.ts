import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CacheService } from '../common/cache.service';
import { DataHealthService } from '../common/data-health.service';

export interface MacroIndicator {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  signal: string;
}

// Currency-specific ETF strength reading
export interface CurrencyStrength {
  currency: string;   // EUR, GBP, JPY, AUD, CHF, CAD
  etf: string;        // FXE, FXB, FXY, FXA, FXF, FXC
  trend: 'bullish' | 'bearish' | 'neutral';
  price: number;
}

// ADR data for a single forex pair
export interface PairADR {
  pair: string;         // e.g. EURUSD=X
  adr14Pips: number;    // 14-day average daily range in pips
  todayRangePips: number;
  exhaustionPct: number; // todayRange / adr14 * 100
  exhausted: boolean;    // > 80%
}

export interface MacroData {
  dxy: MacroIndicator;
  spx: MacroIndicator;
  ndx: MacroIndicator;
  vix: MacroIndicator;
  us10y: MacroIndicator;
  oil: MacroIndicator;
  gold: MacroIndicator;
  copper: MacroIndicator;
  usdcnh: MacroIndicator;
  dax: MacroIndicator;
  ftse: MacroIndicator;
  nikkei: MacroIndicator;
  hyg: MacroIndicator;
  vvix: MacroIndicator;
  skew: MacroIndicator;
  smh: MacroIndicator;
  eem: MacroIndicator;
  silver: MacroIndicator;
  gsRatio: number;        // gold/silver ratio
  copperGoldRatio: number; // copper/gold ratio
  currencyStrength: CurrencyStrength[];
  pairADR: PairADR[];
  riskEnvironment: 'risk-on' | 'risk-off' | 'neutral';
  usdBias: 'bullish' | 'bearish' | 'neutral';
  fetchedAt: string;
}

// Core macro indicators
const SYMBOLS: Record<string, { name: string; yf: string }> = {
  dxy:    { name: 'US Dollar Index',    yf: 'DX-Y.NYB' },
  spx:    { name: 'S&P 500',            yf: '^GSPC' },
  ndx:    { name: 'Nasdaq 100',         yf: '^NDX' },
  vix:    { name: 'VIX Fear Index',     yf: '^VIX' },
  us10y:  { name: 'US 10-Year Yield',   yf: '^TNX' },
  oil:    { name: 'Crude Oil (WTI)',     yf: 'CL=F' },
  gold:   { name: 'Gold (XAU/USD)',      yf: 'GC=F' },
  copper: { name: 'Copper (Dr. Copper)', yf: 'HG=F' },
  usdcnh: { name: 'USD/CNH (China)',     yf: 'USDCNH=X' },
  dax:    { name: 'DAX (Germany)',       yf: '^GDAXI' },
  ftse:   { name: 'FTSE 100 (UK)',       yf: '^FTSE' },
  nikkei: { name: 'Nikkei 225 (Japan)', yf: '^N225' },
  hyg:    { name: 'High Yield Bonds',   yf: 'HYG' },
  vvix:   { name: 'VIX Volatility (VVIX)',  yf: '^VVIX' },
  skew:   { name: 'CBOE SKEW (Tail Risk)',   yf: '^SKEW' },
  smh:    { name: 'Semis ETF (SMH)',         yf: 'SMH' },
  eem:    { name: 'Emerging Markets (EEM)', yf: 'EEM' },
  silver: { name: 'Silver (XAG/USD)',        yf: 'SI=F' },
};

// Currency ETFs — proxy for individual currency strength
const CURRENCY_ETFS: { currency: string; etf: string }[] = [
  { currency: 'EUR', etf: 'FXE' },
  { currency: 'GBP', etf: 'FXB' },
  { currency: 'JPY', etf: 'FXY' },
  { currency: 'AUD', etf: 'FXA' },
  { currency: 'CHF', etf: 'FXF' },
  { currency: 'CAD', etf: 'FXC' },
];

// Forex pairs for ADR calculation
const ADR_PAIRS: { pair: string; yf: string; pipFactor: number }[] = [
  { pair: 'EUR/USD', yf: 'EURUSD=X', pipFactor: 10000 },
  { pair: 'GBP/USD', yf: 'GBPUSD=X', pipFactor: 10000 },
  { pair: 'AUD/USD', yf: 'AUDUSD=X', pipFactor: 10000 },
  { pair: 'NZD/USD', yf: 'NZDUSD=X', pipFactor: 10000 },
  { pair: 'USD/JPY', yf: 'USDJPY=X', pipFactor: 100 },
  { pair: 'USD/CHF', yf: 'USDCHF=X', pipFactor: 10000 },
  { pair: 'USD/CAD', yf: 'USDCAD=X', pipFactor: 10000 },
  { pair: 'GBP/JPY', yf: 'GBPJPY=X', pipFactor: 100 },
];

const CACHE_TTL = 15 * 60;

@Injectable()
export class MacroService {
  private readonly logger = new Logger(MacroService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly health: DataHealthService,
  ) {}

  async getMacroData(): Promise<MacroData> {
    const cached = this.cache.get<MacroData>('macro');
    if (cached) return cached;

    // Fetch all in parallel
    const [indicatorResults, currencyStrength, pairADR] = await Promise.all([
      Promise.all(
        Object.entries(SYMBOLS).map(([key, { name, yf }]) =>
          this.fetchQuote(key, name, yf),
        ),
      ),
      this.fetchCurrencyStrength(),
      this.fetchPairADR(),
    ]);

    // Map results by key instead of positional destructuring
    const indicatorMap = Object.fromEntries(
      Object.keys(SYMBOLS).map((key, i) => [key, indicatorResults[i]])
    );
    const { dxy, spx, ndx, vix, us10y, oil, gold, copper, usdcnh, dax, ftse, nikkei, hyg, vvix, skew, smh, eem, silver } = indicatorMap as Record<string, MacroIndicator>;

    const riskEnvironment = this.classifyRisk(spx, vix, hyg, eem);
    const usdBias = this.classifyUsd(dxy, us10y, spx);

    // Compute ratios
    const gsRatio = silver.price > 0 ? gold.price / silver.price : 0;
    const copperGoldRatio = gold.price > 0 ? copper.price / gold.price : 0;

    const data: MacroData = {
      dxy, spx, ndx, vix, us10y, oil, gold, copper, usdcnh, dax, ftse, nikkei, hyg, vvix, skew, smh, eem, silver,
      gsRatio,
      copperGoldRatio,
      currencyStrength,
      pairADR,
      riskEnvironment,
      usdBias,
      fetchedAt: new Date().toISOString(),
    };

    this.validate(data);

    this.cache.set('macro', data, CACHE_TTL);
    return data;
  }

  /**
   * Перевіряє, що джерела реально віддали дані.
   *
   * Нульова ціна означає, що символ на Yahoo зламався — це вже траплялось із
   * USD/CNH (2026-07-20), і система пів року тихо занижувала бали по AUD/NZD,
   * бо правило "мідь ↓ + юань ↑ → SELL" не могло спрацювати. Тепер це видно
   * одразу: в логах і на /api/health.
   *
   * `affects` перелічує пари, чиї сигнали залежать від конкретного індикатора,
   * щоб UI міг попередити саме про них.
   */
  private validate(d: MacroData): void {
    this.health.clearSource('macro');

    const AUD_NZD = ['AUD/USD', 'NZD/USD'];
    const ALL = [
      'EUR/USD', 'GBP/USD', 'AUD/USD', 'NZD/USD',
      'USD/JPY', 'USD/CHF', 'USD/CAD', 'GBP/JPY',
    ];

    const checks: Array<[string, { price: number }, string[]]> = [
      ['dxy',    d.dxy,    ALL],
      ['spx',    d.spx,    ALL],
      ['vix',    d.vix,    ALL],
      ['us10y',  d.us10y,  ALL],
      ['hyg',    d.hyg,    ALL],
      ['gold',   d.gold,   ['AUD/USD', 'NZD/USD', 'USD/CHF']],
      ['copper', d.copper, AUD_NZD],
      ['usdcnh', d.usdcnh, AUD_NZD],
      ['oil',    d.oil,    ['USD/CAD']],
      ['dax',    d.dax,    ['EUR/USD']],
      ['ftse',   d.ftse,   ['GBP/USD']],
      ['nikkei', d.nikkei, ['USD/JPY', 'GBP/JPY']],
      ['eem',    d.eem,    AUD_NZD],
      ['smh',    d.smh,    AUD_NZD],
    ];

    for (const [field, ind, affects] of checks) {
      this.health.checkPrice('macro', field, ind?.price, affects);
    }

    // Валютні ETF — джерело сили/слабкості кожної ноги пари
    if (!d.currencyStrength?.length) {
      this.health.report({
        source: 'macro',
        field: 'currencyStrength',
        state: 'broken',
        message: 'Немає даних по валютних ETF — фактор кореляції не працює.',
        affects: ALL,
      });
    }

    // ADR живить kill switch "ADR Not Exhausted"
    if (!d.pairADR?.length) {
      this.health.report({
        source: 'macro',
        field: 'pairADR',
        state: 'degraded',
        message: 'Немає ADR — kill switch вичерпання діапазону не перевіряється.',
        affects: ALL,
      });
    }
  }

  private async fetchQuote(key: string, name: string, symbol: string): Promise<MacroIndicator> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=6mo`;
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
      });

      const result = data?.chart?.result?.[0];
      if (!result) throw new Error(`No data for ${symbol}`);

      const meta = result.meta;
      const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
      const closes = rawCloses.filter((c): c is number => c != null && isFinite(c));

      // Для деяких символів (напр. USDCNH=X) Yahoo віддає лише 1 свічку за 6 міс,
      // хоча meta.regularMarketPrice і chartPreviousClose присутні й коректні.
      // Раніше тут кидалась помилка → ціна 0 → правила R2/R3 по AUD/NZD тихо
      // не спрацьовували пів року (виявлено 2026-07-20).
      // Тепер вимагаємо лише наявність ціни; історія потрібна тільки для MA.
      const price = meta.regularMarketPrice ?? closes[closes.length - 1];
      const prevClose =
        meta.chartPreviousClose ??
        meta.previousClose ??
        (closes.length >= 2 ? closes[closes.length - 2] : price);

      if (!Number.isFinite(price) || price === 0) {
        throw new Error(`No usable price for ${symbol}`);
      }
      const change = price - prevClose;
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      // Compute MA50 and MA200 from close prices (v8 API does not return these in meta)
      const ma50 = closes.length >= 50
        ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50
        : null;
      const ma200 = closes.length >= 200
        ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200
        : null;

      const trend = this.classifyTrend(price, ma50 ?? 0, ma200 ?? 0, changePct);
      const signal = this.buildSignal(key, trend, price, changePct);

      return { symbol, name, price, change, changePct, trend, signal };
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('Insufficient candles') || msg.includes('No data')) {
        this.logger.debug(`Skipped ${symbol}: ${msg}`);
      } else {
        this.logger.warn(`Failed to fetch ${symbol}: ${msg}`);
      }
      return { symbol, name, price: 0, change: 0, changePct: 0, trend: 'neutral', signal: 'Data unavailable' };
    }
  }

  private async fetchCurrencyStrength(): Promise<CurrencyStrength[]> {
    return Promise.all(
      CURRENCY_ETFS.map(async ({ currency, etf }) => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${etf}?interval=1d&range=6mo`;
          const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000,
          });
          const result = data?.chart?.result?.[0];
          if (!result) throw new Error(`No ETF data for ${etf}`);
          const meta = result.meta;
          const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
          const closes = rawCloses.filter((c): c is number => c != null && isFinite(c));
          if (closes.length < 2) throw new Error(`Insufficient candles for ${etf}`);
          const price = meta.regularMarketPrice ?? closes[closes.length - 1];
          const prevClose = meta.chartPreviousClose ?? closes[closes.length - 2];
          const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
          const ma50 = closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : 0;
          const ma200 = closes.length >= 200 ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200 : 0;
          const trend = this.classifyTrend(price, ma50, ma200, changePct);
          return { currency, etf, trend, price };
        } catch {
          return { currency, etf, trend: 'neutral' as const, price: 0 };
        }
      }),
    );
  }

  private async fetchPairADR(): Promise<PairADR[]> {
    return Promise.all(
      ADR_PAIRS.map(async ({ pair, yf, pipFactor }) => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yf)}?interval=1d&range=25d`;
          const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000,
          });
          const result = data?.chart?.result?.[0];
          const highs: number[] = result?.indicators?.quote?.[0]?.high ?? [];
          const lows: number[] = result?.indicators?.quote?.[0]?.low ?? [];

          const dailyRanges = highs
            .map((h, i) => (h != null && lows[i] != null ? (h - lows[i]) * pipFactor : null))
            .filter((v): v is number => v !== null && v > 0);

          if (dailyRanges.length < 2) throw new Error('Insufficient candles');

          // ADR14 from the last 14 completed candles (exclude today = last element)
          const completed = dailyRanges.slice(0, -1);
          const adr14Pips = completed.slice(-14).reduce((a, b) => a + b, 0) / Math.min(completed.length, 14);

          // Today's range is the last element
          const todayRangePips = dailyRanges[dailyRanges.length - 1];
          const exhaustionPct = (todayRangePips / adr14Pips) * 100;

          return {
            pair,
            adr14Pips: Math.round(adr14Pips * 10) / 10,
            todayRangePips: Math.round(todayRangePips * 10) / 10,
            exhaustionPct: Math.round(exhaustionPct),
            exhausted: exhaustionPct >= 80,
          };
        } catch (err) {
          this.logger.warn(`ADR fetch failed for ${yf}: ${(err as Error).message}`);
          return { pair, adr14Pips: 0, todayRangePips: 0, exhaustionPct: 0, exhausted: false };
        }
      }),
    );
  }

  private classifyTrend(
    price: number,
    ma50: number,
    ma200: number,
    changePct: number,
  ): 'bullish' | 'bearish' | 'neutral' {
    // Use MA-based classification when both are available; fall back to changePct
    if (ma50 > 0 && ma200 > 0) {
      if (price > ma50 && price > ma200) return 'bullish';
      if (price < ma50 && price < ma200) return 'bearish';
      // Price between MAs — use changePct as tiebreaker
      return changePct > 0.3 ? 'bullish' : changePct < -0.3 ? 'bearish' : 'neutral';
    }
    if (ma50 > 0) {
      return price > ma50 ? 'bullish' : price < ma50 ? 'bearish' : 'neutral';
    }
    // No MAs available — use day change with a wider threshold
    return changePct > 0.5 ? 'bullish' : changePct < -0.5 ? 'bearish' : 'neutral';
  }

  private buildSignal(key: string, trend: 'bullish' | 'bearish' | 'neutral', price: number, changePct: number): string {
    switch (key) {
      case 'dxy':
        return trend === 'bullish'
          ? 'USD strong — avoid buying EUR/USD/GBP/USD'
          : trend === 'bearish'
            ? 'USD weak — look to buy EUR/USD/GBP/USD'
            : 'USD neutral — wait for clearer direction';
      case 'spx':
        return trend === 'bullish'
          ? 'Risk-On: markets confident — favor AUD, NZD, GBP'
          : trend === 'bearish'
            ? 'Risk-Off: fear dominant — favor USD, JPY, CHF'
            : 'Mixed equity signal';
      case 'ndx':
        return trend === 'bearish'
          ? 'Tech selling off — strong USD/JPY bias, short AUD/USD'
          : trend === 'bullish'
            ? 'Tech rallying — AUD/NZD positive'
            : 'Nasdaq neutral';
      case 'vix':
        if (price > 30) return 'EXTREME FEAR — immediate safe-haven buy (USD/JPY/CHF)';
        if (price > 20) return 'Elevated fear — Risk-Off bias active';
        return 'Low fear — Risk-On environment confirmed';
      case 'us10y':
        return trend === 'bullish'
          ? 'Yields rising — USD strength confirmed, JPY under pressure'
          : trend === 'bearish'
            ? 'Yields falling — USD softening, watch USD/JPY for shorts'
            : 'Yields neutral';
      case 'oil':
        return trend === 'bullish'
          ? `Oil ${price.toFixed(0)} bullish — CAD strengthening, USD/CAD bearish pressure`
          : trend === 'bearish'
            ? `Oil ${price.toFixed(0)} bearish — CAD weakening, USD/CAD supported`
            : `Oil ${price.toFixed(0)} neutral`;
      case 'gold':
        return trend === 'bullish'
          ? `Gold ${price.toFixed(0)} bullish — AUD positive, USD/CHF bearish (safe-haven bid)`
          : trend === 'bearish'
            ? `Gold ${price.toFixed(0)} bearish — AUD under pressure`
            : `Gold ${price.toFixed(0)} neutral`;
      case 'copper':
        return trend === 'bullish'
          ? `Copper ${price.toFixed(2)} bullish — global growth signal. AUD/NZD positive.`
          : trend === 'bearish'
            ? `Copper ${price.toFixed(2)} bearish — "Dr. Copper" signals slowdown. AUD/NZD under pressure.`
            : `Copper ${price.toFixed(2)} neutral`;
      case 'usdcnh':
        return trend === 'bullish'
          ? `USD/CNH ${price.toFixed(4)} rising — Yuan weakening. AUD/NZD bearish pressure via China channel.`
          : trend === 'bearish'
            ? `USD/CNH ${price.toFixed(4)} falling — Yuan strengthening. AUD/NZD supported.`
            : `USD/CNH ${price.toFixed(4)} neutral`;
      case 'dax':
        return trend === 'bullish'
          ? `DAX bullish — European capital inflows. EUR/USD supported.`
          : trend === 'bearish'
            ? `DAX bearish — money fleeing Europe to USD. EUR/USD headwinds.`
            : `DAX neutral`;
      case 'ftse':
        return trend === 'bullish'
          ? `FTSE 100 bullish — GBP demand rising.`
          : trend === 'bearish'
            ? `FTSE 100 bearish — GBP/USD under pressure.`
            : `FTSE 100 neutral`;
      case 'nikkei':
        return trend === 'bullish'
          ? `Nikkei bullish — risk-on in Japan, JPY weakening. USD/JPY, GBP/JPY upside.`
          : trend === 'bearish'
            ? `Nikkei bearish — JPY safe-haven bid. Sell USD/JPY, GBP/JPY.`
            : `Nikkei neutral`;
      case 'hyg':
        return trend === 'bullish'
          ? `HYG (High Yield) bullish — credit market healthy. Risk-on confirmed.`
          : trend === 'bearish'
            ? `HYG (High Yield) FALLING — smart money exiting risk. Early risk-off warning. Watch AUD/NZD shorts.`
            : `HYG neutral — credit market stable`;
      case 'vvix':
        return price > 110
          ? `VVIX ${price.toFixed(0)} > 110 — VIX spike 24-48h ahead. Pre-panic signal. WATCH.`
          : price > 100
            ? `VVIX ${price.toFixed(0)} elevated — VIX spike risk rising.`
            : `VVIX ${price.toFixed(0)} calm — no imminent VIX spike.`;
      case 'skew':
        return price > 140
          ? `SKEW ${price.toFixed(0)} > 140 — institutions buying tail hedges. Catastrophe concerns rising.`
          : price > 130
            ? `SKEW ${price.toFixed(0)} elevated — institutional hedging activity.`
            : `SKEW ${price.toFixed(0)} normal — baseline tail risk.`;
      case 'smh':
        return trend === 'bullish'
          ? `SMH (Semis) bullish — tech demand strong. AUD/NZD upside.`
          : trend === 'bearish'
            ? `SMH (Semis) bearish — tech weakness. AUD/NZD at risk.`
            : `SMH neutral`;
      case 'eem':
        return trend === 'bullish'
          ? `EEM (Emerging Markets) bullish — global capital flows risk-on. AUD/NZD supported.`
          : trend === 'bearish'
            ? `EEM (Emerging Markets) FALLING — global capital flight. Risk-off canary. AUD/NZD under pressure.`
            : `EEM neutral`;
      case 'silver':
        return trend === 'bullish'
          ? `Silver ${price.toFixed(2)} bullish — industrial demand rising. Watch Gold/Silver Ratio.`
          : trend === 'bearish'
            ? `Silver ${price.toFixed(2)} bearish — industrial slowdown. Gold/Silver Ratio rising.`
            : `Silver ${price.toFixed(2)} neutral`;
      default:
        return `${trend} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`;
    }
  }

  private classifyRisk(spx: MacroIndicator, vix: MacroIndicator, hyg: MacroIndicator, eem: MacroIndicator): 'risk-on' | 'risk-off' | 'neutral' {
    // HYG falling while SPX holds = smart money quietly exiting = early risk-off signal
    // EEM falling = global capital flight
    const hygWarning = hyg.trend === 'bearish';
    const eemWarning = eem.trend === 'bearish';
    if (spx.trend === 'bullish' && vix.price < 20 && !hygWarning && !eemWarning) return 'risk-on';
    if (spx.trend === 'bearish' || vix.price > 25 || hygWarning || eemWarning) return 'risk-off';
    return 'neutral';
  }

  private classifyUsd(dxy: MacroIndicator, us10y: MacroIndicator, spx: MacroIndicator): 'bullish' | 'bearish' | 'neutral' {
    let score = 0;
    if (dxy.trend === 'bullish') score++;
    if (dxy.trend === 'bearish') score--;
    if (us10y.trend === 'bullish') score++;
    if (us10y.trend === 'bearish') score--;
    if (spx.trend === 'bearish') score++;
    if (spx.trend === 'bullish') score--;
    if (score >= 2) return 'bullish';
    if (score <= -2) return 'bearish';
    return 'neutral';
  }
}
