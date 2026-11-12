import { Injectable } from '@nestjs/common';
import { MlService } from './ml.service';
import { TechnicalService } from '../technical/technical.service';
import { MacroService } from '../macro/macro.service';
import { CotService } from '../cot/cot.service';
import { FredService } from '../fred/fred.service';
import { buildRegimePayload, RegimePayload } from './regime.mapper';

// Per-pair: which currency's CB bias matters most, and whether it's the base (true) or quote (false)
// For USD pairs: Fed bias is always relevant as quote. For non-USD crosses: base currency CB matters.
const PAIR_CB_MAP: Record<string, { base: string; quote: string }> = {
  'EUR/USD': { base: 'EUR', quote: 'USD' },
  'GBP/USD': { base: 'GBP', quote: 'USD' },
  'USD/JPY': { base: 'USD', quote: 'JPY' },
  'AUD/USD': { base: 'AUD', quote: 'USD' },
  'NZD/USD': { base: 'NZD', quote: 'USD' },
  'USD/CAD': { base: 'USD', quote: 'CAD' },
  'USD/CHF': { base: 'USD', quote: 'CHF' },
  'GBP/JPY': { base: 'GBP', quote: 'JPY' },
};

// Approximate CB bias from FRED-derived Fed stance + currency ETF trend as proxy for foreign CB
// Fed hawkish → USD bullish. Foreign CB hawkish → that currency bullish vs USD.
// We only have direct FRED data for the Fed. For other CBs we infer from currency ETF trend.
function derivePairCbBias(
  pair: string,
  fedBias: 'hawkish' | 'dovish' | 'neutral',
  currencyStrength: Array<{ currency: string; trend: string }>,
): { cbBias: string; detail: string } {
  const map = PAIR_CB_MAP[pair];
  if (!map) return { cbBias: fedBias, detail: 'Fed bias only' };

  const baseCcy = map.base;
  const quoteCcy = map.quote;

  // Get ETF trend for the non-USD currency (proxy for its CB stance)
  const getEtfTrend = (ccy: string): 'bullish' | 'bearish' | 'neutral' => {
    const entry = currencyStrength.find(c => c.currency === ccy);
    return (entry?.trend as any) ?? 'neutral';
  };

  if (baseCcy === 'USD') {
    // e.g. USD/JPY, USD/CAD, USD/CHF — Fed drives base
    const foreignTrend = getEtfTrend(quoteCcy);
    // Fed hawkish + foreign CB weak → strong bullish USD bias
    if (fedBias === 'hawkish' && foreignTrend === 'bearish') return { cbBias: 'hawkish', detail: `Fed hawkish + ${quoteCcy} ETF bearish` };
    if (fedBias === 'dovish' && foreignTrend === 'bullish') return { cbBias: 'dovish', detail: `Fed dovish + ${quoteCcy} ETF bullish` };
    return { cbBias: fedBias, detail: `Fed ${fedBias}, ${quoteCcy} ETF ${foreignTrend}` };
  } else {
    // e.g. EUR/USD, GBP/USD — base is foreign, quote is USD
    const baseTrend = getEtfTrend(baseCcy);
    // Base ETF bullish + Fed dovish → BUY base (pair goes up)
    if (baseTrend === 'bullish' && fedBias === 'dovish') return { cbBias: 'dovish', detail: `${baseCcy} ETF bullish + Fed dovish → ${pair} bullish` };
    if (baseTrend === 'bearish' && fedBias === 'hawkish') return { cbBias: 'hawkish', detail: `${baseCcy} ETF bearish + Fed hawkish → ${pair} bearish` };
    // Divergence: base strong but Fed also hawkish — mixed
    if (baseTrend === 'bullish' && fedBias === 'hawkish') return { cbBias: 'neutral', detail: `${baseCcy} ETF bullish vs Fed hawkish — CB divergence` };
    if (baseTrend === 'bearish' && fedBias === 'dovish') return { cbBias: 'neutral', detail: `${baseCcy} ETF bearish vs Fed dovish — CB divergence` };
    return { cbBias: fedBias, detail: `Fed ${fedBias}, ${baseCcy} ETF ${baseTrend}` };
  }
}

const PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD', 'USD/CAD', 'USD/CHF', 'GBP/JPY'];

@Injectable()
export class RegimeService {
  constructor(
    private readonly mlService: MlService,
    private readonly technicalService: TechnicalService,
    private readonly macroService: MacroService,
    private readonly cotService: CotService,
    private readonly fredService: FredService,
  ) {}

  async buildPayload(pair: string, overrides?: {
    systemDirection?: string;
    cbBias?: string;
    liquidityRegime?: string;
    realYieldTrend?: string;
    cotPercentile?: number | null;
    cotVelocity3w?: number | null;
    cotOiDivergence?: 'bullish_exhaustion' | 'bearish_exhaustion' | 'none' | null;
    cotLiquidationRisk?: 'high' | 'moderate' | 'low' | null;
    futuresConfirmation?: import('./regime.mapper').FuturesConfirmation | null;
    dangerZoneActive?: boolean;
    retailLongPct?: number;
    retailSignal?: string;
    adrExhausted?: boolean;
    adrExhaustionPct?: number;
  }): Promise<RegimePayload> {
    const [ml, tech] = await Promise.all([
      this.mlService.analyzePair(pair),
      this.technicalService.analyzePair(pair),
    ]);

    return buildRegimePayload({
      ml,
      tech,
      systemDirection: overrides?.systemDirection ?? 'WATCH',
      cbBias: overrides?.cbBias,
      liquidityRegime: overrides?.liquidityRegime,
      realYieldTrend: overrides?.realYieldTrend,
      cotPercentile: overrides?.cotPercentile,
      cotVelocity3w: overrides?.cotVelocity3w,
      cotOiDivergence: overrides?.cotOiDivergence,
      cotLiquidationRisk: overrides?.cotLiquidationRisk,
      futuresConfirmation: overrides?.futuresConfirmation,
      dangerZoneActive: overrides?.dangerZoneActive,
      retailLongPct: overrides?.retailLongPct,
      retailSignal: overrides?.retailSignal,
      adrExhausted: overrides?.adrExhausted,
      adrExhaustionPct: overrides?.adrExhaustionPct,
    });
  }

  async buildAllPayloads(): Promise<Record<string, RegimePayload>> {
    const [macro, cotData, fred] = await Promise.all([
      this.macroService.getMacroData().catch(() => null),
      this.cotService.getCotData().catch(() => null),
      this.fredService.getFredData().catch(() => null),
    ]);

    const fedBias = fred?.centralBankBias ?? 'neutral';
    const liquidityRegime = fred?.liquidityRegime ?? undefined;
    const realYieldTrend = fred?.realYield?.trend ?? undefined;
    const currencyStrength = macro?.currencyStrength ?? [];

    const results = await Promise.all(PAIRS.map(p => {
      const adr = macro?.pairADR?.find(a => a.pair === p);
      const cot = cotData?.positions?.find(c => c.pair === p);
      const { cbBias } = derivePairCbBias(p, fedBias as any, currencyStrength);
      return this.buildPayload(p, {
        cbBias,
        liquidityRegime,
        realYieldTrend,
        adrExhausted: adr?.exhausted,
        adrExhaustionPct: adr?.exhaustionPct,
        cotVelocity3w: cot?.velocity3w ?? null,
        cotOiDivergence: cot?.oiDivergence ?? null,
        cotLiquidationRisk: cot?.specsLiquidationRisk ?? null,
        futuresConfirmation: cot?.futuresConfirmation ?? null,
      });
    }));
    return Object.fromEntries(PAIRS.map((p, i) => [p, results[i]]));
  }
}
