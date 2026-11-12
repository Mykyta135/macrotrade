import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { CacheService } from '../common/cache.service';

export interface FredSeries {
  id: string;
  name: string;
  latestValue: number;
  previousValue: number;
  change: number;
  trend: 'rising' | 'falling' | 'flat';
  unit: string;
  observationDate: string;
  interpretation: string;
}

export interface YieldCurve {
  us2y: number;          // 2-year yield %
  us10y: number;         // 10-year yield %
  spread: number;        // 10Y - 2Y
  inverted: boolean;     // spread < 0
  signal: string;
}

export interface FredData {
  cpi: FredSeries;
  unemployment: FredSeries;
  fedRate: FredSeries;
  us2y: FredSeries;
  realYield: FredSeries;
  walcl: FredSeries;
  yieldCurve: YieldCurve;
  centralBankBias: 'hawkish' | 'dovish' | 'neutral';
  usdFundamentalBias: 'bullish' | 'bearish' | 'neutral';
  liquidityRegime: 'expanding' | 'contracting' | 'neutral';
  summary: string;
  fetchedAt: string;
  source: string;
}

const SERIES = {
  cpi:          { id: 'CPIAUCSL', name: 'US CPI YoY',           unit: '%' },
  unemployment: { id: 'UNRATE',   name: 'US Unemployment Rate', unit: '%' },
  fedRate:      { id: 'FEDFUNDS', name: 'Fed Funds Rate',        unit: '%' },
  us2y:         { id: 'DGS2',     name: 'US 2-Year Yield',       unit: '%' },
  us10y:        { id: 'DGS10',    name: 'US 10-Year Yield',      unit: '%' },
  realYield:    { id: 'DFII10',   name: '10Y Real Yield (TIPS)', unit: '%' },
  walcl:        { id: 'WALCL',    name: 'Fed Balance Sheet',     unit: '$B' },
};

// DGS2/DGS10 update daily on business days — cache 4h
const YIELD_CACHE_TTL = 4 * 60 * 60;

@Injectable()
export class FredService {
  constructor(private readonly cache: CacheService) {}

  async getFredData(): Promise<FredData> {
    const cached = this.cache.get<FredData>('fred');
    if (cached) return cached;

    const key = process.env.FRED_API_KEY;
    if (!key) throw new Error('FRED_API_KEY is not set in .env');

    const [cpi, unemployment, fedRate, us2y, us10yFred, realYield, walcl] = await Promise.all([
      this.fetchSeries(SERIES.cpi, key, 'pc1').catch(() => this.fallbackSeries(SERIES.cpi)),
      this.fetchSeries(SERIES.unemployment, key, 'lin').catch(() => this.fallbackSeries(SERIES.unemployment)),
      this.fetchSeries(SERIES.fedRate, key, 'lin').catch(() => this.fallbackSeries(SERIES.fedRate)),
      this.fetchSeries(SERIES.us2y, key, 'lin').catch(() => this.fallbackSeries(SERIES.us2y)),
      this.fetchSeries(SERIES.us10y, key, 'lin').catch(() => this.fallbackSeries(SERIES.us10y)),
      this.fetchSeries(SERIES.realYield, key, 'lin').catch(() => this.fallbackSeries(SERIES.realYield)),
      this.fetchSeries(SERIES.walcl, key, 'lin').catch(() => this.fallbackSeries(SERIES.walcl)),
    ]);

    const yieldCurve = this.buildYieldCurve(us2y, us10yFred);
    const liquidityRegime = walcl.trend === 'rising' ? 'expanding'
      : walcl.trend === 'falling' ? 'contracting' : 'neutral';
    const centralBankBias = this.classifyCbBias(cpi, unemployment, fedRate, us2y, realYield);
    const usdFundamentalBias = this.classifyUsdBias(centralBankBias, yieldCurve, realYield);

    const result: FredData = {
      cpi,
      unemployment,
      fedRate,
      us2y,
      realYield,
      walcl,
      yieldCurve,
      liquidityRegime,
      centralBankBias,
      usdFundamentalBias,
      summary: this.buildSummary(cpi, unemployment, fedRate, us2y, yieldCurve, realYield, liquidityRegime, centralBankBias),
      fetchedAt: new Date().toISOString(),
      source: 'FRED (Federal Reserve Economic Data)',
    };

    // Monthly series cache until next month; yield curve refreshes every 4h
    // Use the shorter TTL — yield curve is the most time-sensitive here
    this.cache.set('fred', result, YIELD_CACHE_TTL);
    return result;
  }

  private fallbackSeries(meta: { id: string; name: string; unit: string }): FredSeries {
    return {
      id: meta.id,
      name: meta.name,
      latestValue: 0,
      previousValue: 0,
      change: 0,
      trend: 'flat',
      unit: meta.unit,
      observationDate: '',
      interpretation: `${meta.name} temporarily unavailable.`,
    };
  }

  private async fetchSeries(
    meta: { id: string; name: string; unit: string },
    apiKey: string,
    units: 'lin' | 'pc1' = 'lin',
  ): Promise<FredSeries> {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${meta.id}&api_key=${apiKey}&file_type=json&limit=5&sort_order=desc&units=${units}`;
    const { data } = await axios.get(url, { timeout: 10000 });

    const obs: { date: string; value: string }[] = data.observations ?? [];
    const valid = obs.filter((o) => o.value !== '.');

    const latestValue = parseFloat(valid[0]?.value ?? '0');
    const previousValue = parseFloat(valid[1]?.value ?? '0');
    const change = latestValue - previousValue;
    const trend: 'rising' | 'falling' | 'flat' =
      change > 0.01 ? 'rising' : change < -0.01 ? 'falling' : 'flat';

    return {
      id: meta.id,
      name: meta.name,
      latestValue,
      previousValue,
      change,
      trend,
      unit: meta.unit,
      observationDate: valid[0]?.date ?? '',
      interpretation: this.buildSeriesInterpretation(meta.id, latestValue, trend),
    };
  }

  private buildYieldCurve(us2y: FredSeries, us10y: FredSeries): YieldCurve {
    const spread = us10y.latestValue - us2y.latestValue;
    const inverted = spread < 0;
    let signal: string;
    if (inverted) {
      signal = `INVERTED (2Y ${us2y.latestValue.toFixed(2)}% > 10Y ${us10y.latestValue.toFixed(2)}%). Classic recession signal. Safe havens (USD, JPY, CHF) get long-term fundamental bid.`;
    } else if (spread < 0.3) {
      signal = `FLAT (spread ${spread.toFixed(2)}%). Near-inversion — recession risk elevated. Risk-off bias building.`;
    } else {
      signal = `NORMAL (spread +${spread.toFixed(2)}%). Healthy curve — no recession signal. 2Y at ${us2y.latestValue.toFixed(2)}% is the key Fed expectations proxy.`;
    }
    return { us2y: us2y.latestValue, us10y: us10y.latestValue, spread, inverted, signal };
  }

  private buildSeriesInterpretation(id: string, value: number, trend: 'rising' | 'falling' | 'flat'): string {
    switch (id) {
      case 'CPIAUCSL':
        return trend === 'rising'
          ? `CPI at ${value.toFixed(1)}% and rising — Fed likely to stay hawkish. USD positive.`
          : trend === 'falling'
            ? `CPI at ${value.toFixed(1)}% and falling — Fed rate cuts approaching. USD negative.`
            : `CPI at ${value.toFixed(1)}%, stable — Fed holding. Neutral USD impact.`;
      case 'UNRATE':
        return trend === 'rising'
          ? `Unemployment rising to ${value.toFixed(1)}% — economy cooling. Dovish Fed pressure. USD negative.`
          : trend === 'falling'
            ? `Unemployment falling to ${value.toFixed(1)}% — strong labour market. Hawkish Fed support. USD positive.`
            : `Unemployment at ${value.toFixed(1)}%, stable. Neutral signal.`;
      case 'FEDFUNDS':
        return value > 4.5
          ? `Fed rate at ${value.toFixed(2)}% — historically high. USD very attractive vs low-yield currencies (JPY, CHF).`
          : value > 2.5
            ? `Fed rate at ${value.toFixed(2)}% — moderately restrictive. USD supported.`
            : `Fed rate at ${value.toFixed(2)}% — accommodative. USD headwinds.`;
      case 'DGS2':
        return trend === 'rising'
          ? `2Y yield ${value.toFixed(2)}% rising — market pricing Fed hikes. USD bullish catalyst.`
          : trend === 'falling'
            ? `2Y yield ${value.toFixed(2)}% falling — market pricing cuts. USD bearish, same-day reaction expected.`
            : `2Y yield ${value.toFixed(2)}%, stable — Fed pricing steady.`;
      case 'DGS10':
        return trend === 'rising'
          ? `10Y yield ${value.toFixed(2)}% rising — long-term inflation expectations rising. USD supported.`
          : trend === 'falling'
            ? `10Y yield ${value.toFixed(2)}% falling — growth concerns. USD softening.`
            : `10Y yield ${value.toFixed(2)}%, stable.`;
      case 'DFII10':
        return trend === 'rising'
          ? `Real yield ${value.toFixed(2)}% rising — tighter real conditions. USD structural support.`
          : trend === 'falling'
            ? `Real yield ${value.toFixed(2)}% falling — negative real rates. USD headwind.`
            : `Real yield ${value.toFixed(2)}%, stable — neutral real rate environment.`;
      case 'WALCL':
        return trend === 'rising'
          ? `Fed Balance Sheet ${value.toFixed(0)}B expanding — QE regime. Risk assets supported, USD soft.`
          : trend === 'falling'
            ? `Fed Balance Sheet ${value.toFixed(0)}B contracting — QT regime. Structural headwind for risk assets, USD bid.`
            : `Fed Balance Sheet ${value.toFixed(0)}B stable — neutral liquidity regime.`;
      default:
        return '';
    }
  }

  private classifyCbBias(
    cpi: FredSeries,
    unemployment: FredSeries,
    fedRate: FredSeries,
    us2y: FredSeries,
    realYield: FredSeries,
  ): 'hawkish' | 'dovish' | 'neutral' {
    let score = 0;
    if (cpi.trend === 'rising') score++;
    if (cpi.trend === 'falling') score--;
    if (unemployment.trend === 'falling') score++;
    if (unemployment.trend === 'rising') score--;
    if (fedRate.latestValue > 4) score++;
    if (fedRate.trend === 'falling') score--;
    // 2Y yield rising = market expects Fed to stay higher = hawkish signal
    if (us2y.trend === 'rising') score++;
    if (us2y.trend === 'falling') score--;
    // Real yield rising = tighter real conditions = hawkish
    if (realYield.trend === 'rising') score++;
    if (realYield.trend === 'falling') score--;
    if (score >= 2) return 'hawkish';
    if (score <= -2) return 'dovish';
    return 'neutral';
  }

  private classifyUsdBias(
    bias: 'hawkish' | 'dovish' | 'neutral',
    yieldCurve: YieldCurve,
    realYield: FredSeries,
  ): 'bullish' | 'bearish' | 'neutral' {
    // Negative real yields always hurt USD structurally
    if (realYield.latestValue < 0 && realYield.trend === 'falling') return 'bearish';
    // Inverted curve overrides — safe haven demand = USD bullish regardless of Fed bias
    if (yieldCurve.inverted) return 'bullish';
    if (bias === 'hawkish') return 'bullish';
    if (bias === 'dovish') return 'bearish';
    return 'neutral';
  }

  private buildSummary(
    cpi: FredSeries,
    unemployment: FredSeries,
    fedRate: FredSeries,
    us2y: FredSeries,
    yieldCurve: YieldCurve,
    realYield: FredSeries,
    liquidityRegime: 'expanding' | 'contracting' | 'neutral',
    bias: 'hawkish' | 'dovish' | 'neutral',
  ): string {
    return (
      `Fed is ${bias.toUpperCase()}. ` +
      `CPI ${cpi.latestValue.toFixed(1)}% (${cpi.trend}), ` +
      `Unemployment ${unemployment.latestValue.toFixed(1)}% (${unemployment.trend}), ` +
      `Fed Rate ${fedRate.latestValue.toFixed(2)}%. ` +
      `2Y yield ${us2y.latestValue.toFixed(2)}% (${us2y.trend}) — fastest Fed expectations proxy. ` +
      `Real yield ${realYield.latestValue.toFixed(2)}% (${realYield.trend}). ` +
      `Liquidity: ${liquidityRegime}. ` +
      `Curve: ${yieldCurve.inverted ? 'INVERTED ⚠' : `+${yieldCurve.spread.toFixed(2)}%`}. ` +
      (bias === 'hawkish'
        ? 'Multi-week USD bullish bias.'
        : bias === 'dovish'
          ? 'Multi-week USD bearish bias. Look for EUR/GBP/AUD strength vs USD.'
          : 'Mixed data. No strong fundamental directional bias currently.')
    );
  }
}
