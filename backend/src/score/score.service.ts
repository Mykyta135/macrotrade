import { Injectable } from '@nestjs/common';
import { MacroService } from '../macro/macro.service';
import { SentimentService } from '../sentiment/sentiment.service';
import { CotService } from '../cot/cot.service';
import { CalendarService } from '../calendar/calendar.service';
import { FredService } from '../fred/fred.service';

export interface KillSwitch {
  name: string;
  passed: boolean;
  detail: string;
  unlockCondition: string | null;
}

export interface ScoreFactor {
  name: string;
  score: number;
  maxScore: number;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
}

export interface PairScore {
  pair: string;
  baseCurrency: string;
  quoteCurrency: string;
  direction: 'BUY' | 'SELL' | 'WATCH' | 'NO TRADE';
  totalScore: number;
  maxScore: number;  // always 5
  grade: 'A' | 'B' | 'C' | 'WATCH' | 'NO TRADE';
  tradeRecommendation: string;
  killSwitches: KillSwitch[];
  killSwitchBlocked: boolean;
  watchlistReason: string | null;
  liquidityTrapWarning: string | null;
  r2InversionNote: string | null;
  factors: ScoreFactor[];
  dangerZoneBlock: boolean;
}

export interface ScoreData {
  pairs: PairScore[];
  topSetup: PairScore | null;
  topWatch: PairScore | null;
  dangerZoneActive: boolean;
  dangerZoneMessage: string | null;
  weeklyProfile: string;
  scorecardSummary: string;
  fetchedAt: string;
}

const TRACKED_PAIRS = [
  { pair: 'EUR/USD', base: 'EUR', quote: 'USD' },
  { pair: 'GBP/USD', base: 'GBP', quote: 'USD' },
  { pair: 'AUD/USD', base: 'AUD', quote: 'USD' },
  { pair: 'NZD/USD', base: 'NZD', quote: 'USD' },
  { pair: 'USD/JPY', base: 'USD', quote: 'JPY' },
  { pair: 'USD/CHF', base: 'USD', quote: 'CHF' },
  { pair: 'USD/CAD', base: 'USD', quote: 'CAD' },
  { pair: 'GBP/JPY', base: 'GBP', quote: 'JPY' },
];

@Injectable()
export class ScoreService {
  constructor(
    private readonly macroService: MacroService,
    private readonly sentimentService: SentimentService,
    private readonly cotService: CotService,
    private readonly calendarService: CalendarService,
    private readonly fredService: FredService,
  ) {}

  async getScoreData(): Promise<ScoreData> {
    const [macro, sentiment, cot, calendar, fred] = await Promise.all([
      this.macroService.getMacroData(),
      this.sentimentService.getSentimentData(),
      this.cotService.getCotData(),
      this.calendarService.getCalendarData(),
      this.fredService.getFredData(),
    ]);

    const pairs = TRACKED_PAIRS.map((p) =>
      this.scorePair(p, macro, sentiment, cot, calendar, fred),
    );

    const sorted = [...pairs].sort((a, b) => b.totalScore - a.totalScore);
    const topSetup = sorted.find((p) => p.direction === 'BUY' || p.direction === 'SELL') ?? null;
    const topWatch = sorted.find((p) => p.direction === 'WATCH') ?? null;

    return {
      pairs,
      topSetup,
      topWatch,
      dangerZoneActive: calendar.dangerZoneActive,
      dangerZoneMessage: calendar.dangerZoneMessage,
      weeklyProfile: this.getWeeklyProfile(),
      scorecardSummary: this.buildSummary(macro, fred, sorted),
      fetchedAt: new Date().toISOString(),
    };
  }

  private scorePair(
    { pair, base, quote }: { pair: string; base: string; quote: string },
    macro: Awaited<ReturnType<MacroService['getMacroData']>>,
    sentiment: Awaited<ReturnType<SentimentService['getSentimentData']>>,
    cot: Awaited<ReturnType<CotService['getCotData']>>,
    calendar: Awaited<ReturnType<CalendarService['getCalendarData']>>,
    fred: Awaited<ReturnType<FredService['getFredData']>>,
  ): PairScore {
    // ── HYBRID HIERARCHICAL CASCADE WITH CONTEXTUAL INVERSION ──────────────────
    // R4 (Execution/Calendar) → R1 (Macro) → R2 (Intermarket) → R3 (Sentiment)
    // Each level decides: CONFIRM, INVERT, or HALT
    // ═══════════════════════════════════════════════════════════════════════════
    // ► R4: EXECUTION VETO LEVEL — Can we even trade this pair today?
    // ═══════════════════════════════════════════════════════════════════════════
    const dangerZoneBlock = calendar.dangerZoneActive;
    const relevantNews = calendar.highImpactNext24h.filter(
      (e) =>
        (e.country === base || e.country === quote) &&
        e.minutesUntil !== null && e.minutesUntil >= 0 && e.minutesUntil <= 120,
    );
    const vixPanic = macro.vix.price > 30;
    const newsClear = relevantNews.length === 0 && !dangerZoneBlock && !vixPanic;
    const nextEvent = relevantNews[0];

    // Kill Switch 1: News & Panic Veto
    const killNews: KillSwitch = {
      name: 'News Clear (≥2h from high-impact event)',
      passed: newsClear,
      detail: vixPanic
        ? `VIX ${macro.vix.price.toFixed(0)} > 30 — PANIC MODE. No trading.`
        : newsClear
          ? 'No high-impact event within 2 hours for this pair'
          : dangerZoneBlock
            ? calendar.dangerZoneMessage ?? 'Danger zone active'
            : `"${nextEvent?.title}" (${nextEvent?.country}) in ${nextEvent?.minutesUntil} min`,
      unlockCondition: vixPanic
        ? 'Wait for VIX to drop below 25. Panic trades are traps.'
        : newsClear
          ? null
          : dangerZoneBlock
            ? 'Wait 30 min after the current event resolves'
            : `Wait until "${nextEvent?.title}" passes (${nextEvent?.minutesUntil} min)`,
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ► R1: MACRO BASELINE LEVEL — What does macro say?
    // ═══════════════════════════════════════════════════════════════════════════
    const expectedDir = this.getExpectedDirection(base, quote, macro, fred);

    // ═══════════════════════════════════════════════════════════════════════════
    // ► R2: INTERMARKET LIE DETECTOR — Does it match the narrative?
    // ═══════════════════════════════════════════════════════════════════════════
    const r2Result = this.detectR2Inversion(pair, base, quote, expectedDir, macro);
    const effectiveDir = r2Result.invertedDir;
    const r2Note = r2Result.reason;

    // KS 2: US Bond Yields align (10Y trend + 2Y fast proxy — both must agree)
    // 2Y yield is the fastest Fed expectations proxy; 10Y shows long-term growth view.
    // If they conflict (e.g. 10Y rising but 2Y falling), the signal is ambiguous — block.
    const us10yRising = macro.us10y.trend === 'bullish';
    const us2yRising = fred.us2y.trend === 'rising';
    const yieldsAgreeBullish = us10yRising && us2yRising;   // both up = hawkish = USD bid
    const yieldsAgreeBearish = !us10yRising && !us2yRising; // both down = dovish = USD sold
    const yieldsMixed = us10yRising !== us2yRising;          // divergence = ambiguous

    const tradeNeedsUSDUp = (base === 'USD' && effectiveDir === 'BUY') || (quote === 'USD' && effectiveDir === 'SELL');
    const tradeNeedsUSDDown = (quote === 'USD' && effectiveDir === 'BUY') || (base === 'USD' && effectiveDir === 'SELL');

    let yieldAligned: boolean;
    if (tradeNeedsUSDUp) yieldAligned = yieldsAgreeBullish && !yieldsMixed;
    else if (tradeNeedsUSDDown) yieldAligned = yieldsAgreeBearish && !yieldsMixed;
    else yieldAligned = !yieldsMixed; // cross pairs: require yields to agree on something

    const yieldSummary = `US2Y ${fred.us2y.latestValue.toFixed(2)}% (${fred.us2y.trend}) | US10Y ${macro.us10y.price.toFixed(2)}% (${macro.us10y.trend})`;
    const killYields: KillSwitch = {
      name: 'US Bond Yields Align (10Y + 2Y)',
      passed: yieldAligned,
      detail: yieldAligned
        ? `${yieldSummary} — both agree, confirms ${effectiveDir} ${pair}`
        : yieldsMixed
          ? `${yieldSummary} — 10Y and 2Y DIVERGE. Ambiguous Fed signal. Wait for clarity.`
          : `${yieldSummary} — yield direction conflicts with ${effectiveDir} ${pair}`,
      unlockCondition: yieldAligned
        ? null
        : yieldsMixed
          ? 'Wait for 2Y and 10Y to agree. 2Y is the faster signal — watch for it to confirm the 10Y direction.'
          : tradeNeedsUSDDown
            ? 'Watch for US10Y and US2Y to roll over below their recent swing lows'
            : 'Watch for US10Y and US2Y to break above their recent swing highs',
    };

    // KS 3: Weekly trend (DXY) aligns
    const weeklyTrendAligned = this.checkWeeklyTrendAlignment(base, quote, effectiveDir, macro);
    const killWeekly: KillSwitch = {
      name: 'Weekly Trend Aligns',
      passed: weeklyTrendAligned,
      detail: weeklyTrendAligned
        ? `DXY ${macro.dxy.trend}, USD bias ${macro.usdBias} — weekly trend confirms ${effectiveDir} ${pair}`
        : `DXY ${macro.dxy.trend} conflicts with ${effectiveDir} ${pair}`,
      unlockCondition: weeklyTrendAligned
        ? null
        : 'Wait for DXY weekly candle to close in the required direction. Reassess on Monday open.',
    };

    // KS 4: ADR not exhausted
    const adrData = macro.pairADR.find((a) => a.pair === pair);
    const adrBlocked = adrData?.exhausted ?? false;
    const killADR: KillSwitch = {
      name: 'ADR Not Exhausted (<80% of 14-day range)',
      passed: !adrBlocked,
      detail: adrData
        ? `${pair} ADR14: ${adrData.adr14Pips} pips | Today: ${adrData.todayRangePips} pips (${adrData.exhaustionPct}%)${adrBlocked ? ' — FUEL EXHAUSTED' : ''}`
        : 'ADR data unavailable',
      unlockCondition: adrBlocked
        ? `Today's range (${adrData?.todayRangePips} pips) is ${adrData?.exhaustionPct}% of the ADR14 (${adrData?.adr14Pips} pips). Wait for next session — fresh range resets at market open.`
        : null,
    };

    const killSwitches = [killNews, killYields, killWeekly, killADR];
    const killSwitchBlocked = killSwitches.some((k) => !k.passed);

    // ── STEP 2: Weighted Point System (max 5 pts, need ≥3) ───────────────────

    const factors: ScoreFactor[] = [];

    // ═══════════════════════════════════════════════════════════════════════════
    // ► R3: SENTIMENT TRAP SETTER — Adapt entry if needed
    // ═══════════════════════════════════════════════════════════════════════════

    // Factor A: Retail Sentiment — 2 pts strong (>70%), 1 pt moderate (60–70%)
    const pairKey = pair.replace('/', '');
    const sentData = sentiment.pairs.find((p) => p.symbol === pairKey);
    let sentScore = 0;
    let sentDetail = 'No sentiment data available';
    let sentShortPct = 0;
    let sentLongPct = 0;
    if (sentData) {
      sentShortPct = sentData.shortPct;
      sentLongPct = sentData.longPct;
      const crowdAgainstBuy = sentData.signal === 'fade-shorts';
      const crowdAgainstSell = sentData.signal === 'fade-longs';
      const aligned =
        (effectiveDir === 'BUY' && crowdAgainstBuy) ||
        (effectiveDir === 'SELL' && crowdAgainstSell);
      if (aligned) sentScore = sentData.signalStrength === 'strong' ? 2 : 1;
      sentDetail = sentData.interpretation;
    }
    factors.push({
      name: 'Retail Sentiment (CFTC non-reportable)',
      score: sentScore,
      maxScore: 2,
      status: sentScore === 2 ? 'pass' : sentScore === 1 ? 'warn' : 'fail',
      detail: sentDetail,
    });

    // Factor B: COT institutional positioning — 2 pts aligned, 0 opposing
    const baseCot = cot.positions.find((p) => p.currency === base);
    const quoteCot = cot.positions.find((p) => p.currency === quote);
    let cotScore = 0;
    let cotDetail = 'No COT data';
    let cotBias: 'bullish' | 'bearish' | null = null;
    if (baseCot || quoteCot) {
      const baseHedgeBullish = baseCot?.bias === 'bullish';
      const quoteHedgeBullish = quoteCot?.bias === 'bullish';
      const cotConfirmsBuy = (baseCot && baseHedgeBullish) || (quoteCot && !quoteHedgeBullish);
      const cotConfirmsSell = (baseCot && !baseHedgeBullish) || (quoteCot && quoteHedgeBullish);
      const cotAligned =
        (effectiveDir === 'BUY' && cotConfirmsBuy) ||
        (effectiveDir === 'SELL' && cotConfirmsSell);
      cotScore = cotAligned ? 2 : 0;
      cotBias = cotConfirmsBuy ? 'bullish' : 'bearish';
      cotDetail = [baseCot?.signal, quoteCot?.signal].filter(Boolean).join(' | ');
    }
    factors.push({
      name: 'COT Report (Hedge Funds)',
      score: cotScore,
      maxScore: 2,
      status: cotScore === 2 ? 'pass' : 'fail',
      detail: cotDetail,
    });

    // Factor C: Correlation — 1 pt
    // Checks: DXY+SPX intermarket consensus, commodity alignment (Oil→CAD, Gold→AUD),
    // and currency ETF strength (both legs trending the right way)
    const { corrScore, corrDetail } = this.getCorrelationScore(pair, base, quote, effectiveDir, macro, fred);
    factors.push({
      name: 'Correlated Pairs + Commodities',
      score: corrScore,
      maxScore: 1,
      status: corrScore === 1 ? 'pass' : 'fail',
      detail: corrDetail,
    });

    // ── Liquidity Trap Detection ──────────────────────────────────────────────
    const liquidityTrapWarning = this.detectLiquidityTrap(pair, sentData, cotBias, sentShortPct, sentLongPct);

    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
    const maxScore = 5;

    let direction: 'BUY' | 'SELL' | 'WATCH' | 'NO TRADE';
    if (totalScore < 3) {
      direction = 'NO TRADE';
    } else if (killSwitchBlocked || dangerZoneBlock) {
      direction = 'WATCH';
    } else {
      direction = effectiveDir;
    }

    const watchlistReason = direction === 'WATCH'
      ? this.buildWatchlistReason(pair, effectiveDir, killSwitches, dangerZoneBlock, calendar.dangerZoneMessage)
      : null;

    const grade =
      direction === 'BUY' || direction === 'SELL'
        ? totalScore === 5 ? 'A' : totalScore >= 3 ? 'B' : 'C'
        : direction === 'WATCH' ? 'WATCH' : 'NO TRADE';

    return {
      pair,
      baseCurrency: base,
      quoteCurrency: quote,
      direction,
      totalScore,
      maxScore,
      grade,
      tradeRecommendation: this.buildRecommendation(
        pair, direction, effectiveDir, totalScore, killSwitches,
        dangerZoneBlock, calendar.dangerZoneMessage, watchlistReason,
      ),
      killSwitches,
      killSwitchBlocked,
      watchlistReason,
      liquidityTrapWarning,
      r2InversionNote: r2Note,
      factors,
      dangerZoneBlock,
    };
  }

  // ── R2 Lie Detector: Detect intermarket divergences that invert the baseline direction ──────
  // Hybrid approach: Universal macro vetoes FIRST, then pair-specific checks
  // Critical: Order matters — global panic (VIX) vetoes regional drivers (DAX, Oil, etc.)
  private detectR2Inversion(
    pair: string,
    base: string,
    _quote: string,
    expectedDir: 'BUY' | 'SELL',
    macro: Awaited<ReturnType<MacroService['getMacroData']>>,
  ): { inverted: boolean; invertedDir: 'BUY' | 'SELL'; reason: string | null } {
    const isRiskCurrency = ['AUD', 'NZD', 'GBP', 'CAD', 'EUR'].includes(base);

    // ═══════════════════════════════════════════════════════════════════════════
    // LEVEL 1: UNIVERSAL MACRO VETOES (Выполняются первыми!)
    // Order of execution is CRITICAL — global panic vetoes all regional drivers
    // ═══════════════════════════════════════════════════════════════════════════

    // 1. Універсальна паніка (VIX > 25)
    // Якщо паніка, то ризик OFF незалежно від того, що робить DAX чи Oil
    if (macro.vix.price > 25 && isRiskCurrency && expectedDir === 'BUY') {
      return {
        inverted: true,
        invertedDir: 'SELL',
        reason: `⚠ R2 INVERSION (VIX Panic): VIX ${macro.vix.price.toFixed(0)} > 25 — Global risk-off override. INVERT ${base} BUY to SELL.`,
      };
    }

    // 2. Універсальна кредитна дивергенція (Smart Money Exit Detector)
    // SPX росте (ніби все добре), але HYG (high-yield кредити) падає (smart money виходить)
    // Це означає, що ринок акцій лжеце — це не реальний ріст, а pump-and-dump перед крахом
    const spxBullish = macro.spx.trend === 'bullish';
    const hygBearish = macro.hyg.trend === 'bearish';
    const spxHygDivergence = spxBullish && hygBearish;

    if (isRiskCurrency && spxHygDivergence && expectedDir === 'BUY') {
      return {
        inverted: true,
        invertedDir: 'SELL',
        reason: `⚠ R2 INVERSION (Credit Divergence - HYG): SPX up but HYG down — smart money exiting. ${base} BUY is a fake rally trap. INVERT to SELL.`,
      };
    }

    // 2.5: VVIX (Volatility of VIX) — 24-48h forward panic detector
    if (macro.vvix && macro.vvix.price > 110 && isRiskCurrency && expectedDir === 'BUY') {
      return {
        inverted: false,
        invertedDir: expectedDir,
        reason: `⚠ R2 WARNING (VVIX Pre-Panic): VVIX ${macro.vvix.price.toFixed(0)} > 110. VIX spike 24-48h ahead. WATCH ${base}.`,
      };
    }

    // 2.6: SKEW (CBOE Tail Risk) — Institutional catastrophe hedging (quiet until it's loud)
    if (macro.skew && macro.skew.price > 140 && macro.vix.price < 20 && isRiskCurrency && expectedDir === 'BUY') {
      return {
        inverted: false,
        invertedDir: expectedDir,
        reason: `⚠ R2 WARNING (SKEW Tail Risk): SKEW ${macro.skew.price.toFixed(0)} > 140 with VIX quiet. Institutional hedging. WATCH ${base}.`,
      };
    }

    // 2.7: EEM (Emerging Markets) — Global capital flight canary
    if (macro.eem && macro.eem.trend === 'bearish' && isRiskCurrency && expectedDir === 'BUY') {
      return {
        inverted: true,
        invertedDir: 'SELL',
        reason: `⚠ R2 INVERSION (EEM Risk-Off): Emerging Markets ETF falling — global capital flight. INVERT ${base} BUY to SELL.`,
      };
    }

    // 2.8: NDX/SMH Divergence (AUD/NZD only) — Hollow tech rally detector
    if ((pair === 'AUD/USD' || pair === 'NZD/USD') && expectedDir === 'BUY') {
      if (macro.ndx.trend === 'bullish' && macro.smh && macro.smh.trend === 'bearish') {
        return {
          inverted: false,
          invertedDir: expectedDir,
          reason: `⚠ R2 WARNING (NDX/SMH Divergence): Nasdaq up but Semis falling — tech rally hollow. WATCH ${base}.`,
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LEVEL 2: PAIR-SPECIFIC ISOLATED WEAKNESS (Приватні драйвери)
    // Only checked if global vetoes didn't trigger
    // ═══════════════════════════════════════════════════════════════════════════

    // 3. EUR/USD: DAX (European equities) + FXE (Euro ETF)
    // Німеччина ростить, але Євро падає = капітал НЕ йде в EUR = ізольована слабкість
    if (pair === 'EUR/USD') {
      const daxBullish = macro.dax.trend === 'bullish';
      const fxe = macro.currencyStrength.find((cs) => cs.currency === 'EUR');
      const fxeBearish = fxe?.trend === 'bearish';

      if (daxBullish && fxeBearish && expectedDir === 'BUY') {
        return {
          inverted: true,
          invertedDir: 'SELL',
          reason: `⚠ R2 INVERSION (DAX/FXE divergence): DAX rallying but FXE falling — EUR isolated weakness. INVERT to SELL EUR/USD.`,
        };
      }
    }

    // 4. GBP/USD: FTSE (UK equities) + FXB (GBP ETF)
    // Британія ростить, але Фунт падає = капітал НЕ йде в GBP = ізольована слабкість
    if (pair === 'GBP/USD') {
      const ftseBullish = macro.ftse.trend === 'bullish';
      const fxb = macro.currencyStrength.find((cs) => cs.currency === 'GBP');
      const fxbBearish = fxb?.trend === 'bearish';

      if (ftseBullish && fxbBearish && expectedDir === 'BUY') {
        return {
          inverted: true,
          invertedDir: 'SELL',
          reason: `⚠ R2 INVERSION (FTSE/FXB divergence): FTSE up but FXB down — GBP isolated weakness. INVERT to SELL GBP/USD.`,
        };
      }
    }

    // 5. USD/CAD: Oil (commodity driver) + FXC (CAD ETF)
    // Ми хочемо SELL USD/CAD (купити канадця). Нафта росте (добре для CAD), але FXC падає (CAD слабка).
    // Це дивергенція — сировина сигналізує на зростання, але валюта не відповідає = WATCH (не входимо)
    if (pair === 'USD/CAD') {
      const oilBullish = macro.oil.trend === 'bullish';
      const fxc = macro.currencyStrength.find((cs) => cs.currency === 'CAD');
      const fxcBearish = fxc?.trend === 'bearish';

      if (oilBullish && fxcBearish && expectedDir === 'SELL') {
        return {
          inverted: false,
          invertedDir: expectedDir,
          reason: `⚠ R2 WARNING (Oil/FXC divergence): Oil rising but CAD falling. Commodity signal not confirmed. WATCH USD/CAD.`,
        };
      }
    }

    // 6. AUD/USD & NZD/USD: Copper (Dr. Copper = global growth) + USD/CNH (China proxy)
    // Ми хочемо BUY AUD/USD. Але Мідь падає (промислість гальмує) або Юань падає (Китай кровоточить).
    // Це означає, що азійський спрос впаде. Скасовуємо BUY.
    if ((pair === 'AUD/USD' || pair === 'NZD/USD') && expectedDir === 'BUY') {
      const copperBearish = macro.copper.trend === 'bearish';
      const usdcnhBullish = macro.usdcnh.trend === 'bullish'; // Yuan weakening

      if (copperBearish && usdcnhBullish) {
        return {
          inverted: true,
          invertedDir: 'SELL',
          reason: `⚠ R2 INVERSION (Copper + USD/CNH bearish): Industrial demand stalling, Yuan weakening. Asia pain signals. INVERT to SELL ${base}.`,
        };
      }
    }

    // 7. USD/CHF: Safe Haven Strength Check (Gold + FXF)
    // Gold up = safe-haven demand = CHF up = SELL USD/CHF (buy CHF)
    // BUT if Gold up but FXF (CHF ETF) down = CHF ETF not responding = weak signal
    if (pair === 'USD/CHF' && expectedDir === 'SELL') {
      const goldBullish = macro.gold.trend === 'bullish';
      const fxf = macro.currencyStrength.find((cs) => cs.currency === 'CHF');
      const fxfBearish = fxf?.trend === 'bearish';

      if (goldBullish && fxfBearish) {
        return {
          inverted: false,
          invertedDir: expectedDir,
          reason: `⚠ R2 WARNING (Gold/FXF divergence): Gold rising (safe-haven signal) but FXF falling (CHF weak). Safe-haven bid unconfirmed. WATCH USD/CHF.`,
        };
      }
    }

    // 8. JPY Pairs: Safe Haven FAILURE (Not normal carry trade)
    // КРИТИЧНЕ ВИПРАВЛЕННЯ: Nikkei↑ + FXY↓ = НОРМАЛЬНЕ CARRY TRADE, це НЕ дивергенція!
    // Справжня дивергенція: Nikkei↓ (паніка в Японії) + FXY↓ (Єна падає, хоча повинна рости)
    // Це означає, що BoJ втратив контроль. У такій ситуації ми скасовуємо SELL USD/JPY.
    if ((pair === 'USD/JPY' || pair === 'GBP/JPY') && expectedDir === 'SELL') {
      const nikkeiBeareish = macro.nikkei.trend === 'bearish'; // Panic in Japan
      const fxy = macro.currencyStrength.find((cs) => cs.currency === 'JPY');
      const fxyBearish = fxy?.trend === 'bearish'; // JPY still falling despite panic

      // Nikkei crashes (should drive JPY up as safe-haven) BUT FXY still falls = BoJ control lost
      if (nikkeiBeareish && fxyBearish) {
        return {
          inverted: false,
          invertedDir: expectedDir, // Keep SELL but signal divergence (kill switch will convert to WATCH)
          reason: `⚠ R2 WARNING (Safe Haven Failure): Nikkei down (panic) but FXY also down (JPY weak). BoJ control lost. WATCH ${pair}, don't force SELL.`,
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DEFAULT: Всі структури вирівняні, дивергенцій немає
    // ═══════════════════════════════════════════════════════════════════════════
    return { inverted: false, invertedDir: expectedDir, reason: null };
  }

  // ── Pair-specific correlation profile ────────────────────────────────────────
  // Each pair has its own hidden driver profile. Score = 1 if majority confirm.
  private getCorrelationScore(
    pair: string,
    base: string,
    quote: string,
    expectedDir: 'BUY' | 'SELL',
    macro: Awaited<ReturnType<MacroService['getMacroData']>>,
    fred: Awaited<ReturnType<FredService['getFredData']>>,
  ): { corrScore: number; corrDetail: string } {
    const signals: string[] = [];
    let confirming = 0;
    let total = 0;

    const check = (condition: boolean, passMsg: string, failMsg: string) => {
      total++;
      if (condition) { confirming++; signals.push(`✓ ${passMsg}`); }
      else { signals.push(`✗ ${failMsg}`); }
    };

    // ── Universal: Currency ETF strength (strongest vs weakest) ──────────────
    // FXY note: JPY often lives independently due to BoJ. If FXY is in a strong
    // directional trend, the move is likely to continue — don't fade it.
    const baseEtf = macro.currencyStrength.find((cs) => cs.currency === base);
    const quoteEtf = macro.currencyStrength.find((cs) => cs.currency === quote);
    if (baseEtf && quoteEtf) {
      const baseFavors = expectedDir === 'BUY' ? baseEtf.trend === 'bullish' : baseEtf.trend === 'bearish';
      const quoteFavors = expectedDir === 'BUY' ? quoteEtf.trend === 'bearish' : quoteEtf.trend === 'bullish';
      // Both legs must align (strongest vs weakest)
      check(
        baseFavors && quoteFavors,
        `${base} ETF (${baseEtf.etf}) ${baseEtf.trend} + ${quote} ETF (${quoteEtf.etf}) ${quoteEtf.trend} — strongest vs weakest confirmed`,
        `${base} ETF ${baseEtf.trend} / ${quote} ETF ${quoteEtf.trend} — currency strength partial or conflicting`,
      );
    }

    // ── AUD/USD & NZD/USD profile: Gold + Copper + USD/CNH + SPX/NDX ─────────
    if (pair === 'AUD/USD' || pair === 'NZD/USD') {
      // Gold (AUD is top gold exporter; gold rising = AUD demand)
      check(
        macro.gold.trend !== 'neutral' && (expectedDir === 'BUY') === (macro.gold.trend === 'bullish'),
        `Gold ${macro.gold.trend} (${macro.gold.price.toFixed(0)}) — AUS/NZ commodity confirms ${base}`,
        `Gold ${macro.gold.trend} — conflicts or neutral for ${base}`,
      );
      // Copper ("Dr. Copper" = global industrial demand = AUD/NZD driver)
      check(
        macro.copper.trend !== 'neutral' && (expectedDir === 'BUY') === (macro.copper.trend === 'bullish'),
        `Copper ${macro.copper.trend} (${macro.copper.price.toFixed(2)}) — global growth signal confirms ${base}`,
        `Copper ${macro.copper.trend} — industrial growth signal conflicts or neutral`,
      );
      // USD/CNH: Yuan weakening = AUD/NZD bearish (China is AUS/NZ top trade partner)
      check(
        macro.usdcnh.trend !== 'neutral' && (expectedDir === 'BUY') === (macro.usdcnh.trend === 'bearish'),
        `USD/CNH ${macro.usdcnh.trend} — Yuan strengthening, China/Asia channel supports ${base}`,
        `USD/CNH ${macro.usdcnh.trend === 'bullish' ? 'rising' : 'neutral'} — Yuan ${macro.usdcnh.trend === 'bullish' ? 'weakening, pressure on' : 'neutral for'} ${base}`,
      );
      // NDX as risk-on tagger: Nasdaq rallying = AUD demand (tech-driven risk appetite)
      check(
        macro.ndx.trend !== 'neutral' && (expectedDir === 'BUY') === (macro.ndx.trend === 'bullish'),
        `Nasdaq ${macro.ndx.trend} — tech risk appetite tails ${base} demand`,
        `Nasdaq ${macro.ndx.trend} — risk appetite not supporting ${base}`,
      );
      // SMH: semiconductor demand as tech risk-on proxy for AUD
      if (macro.smh) {
        check(
          macro.smh.trend !== 'neutral' && (expectedDir === 'BUY') === (macro.smh.trend === 'bullish'),
          `SMH ${macro.smh.trend} — semiconductor demand confirms tech risk for ${base}`,
          `SMH ${macro.smh.trend} — semis not supporting risk-on for ${base}`,
        );
      }
      // EEM: global risk flows (China/EM channel)
      if (macro.eem) {
        check(
          macro.eem.trend !== 'neutral' && (expectedDir === 'BUY') === (macro.eem.trend === 'bullish'),
          `EEM ${macro.eem.trend} — EM capital flows support ${base}`,
          `EEM ${macro.eem.trend} — EM capital flight, ${base} at risk`,
        );
      }
    }

    // ── USD/CAD profile: Oil ──────────────────────────────────────────────────
    if (pair === 'USD/CAD') {
      // Oil bullish = CAD strong = sell USD/CAD (inverse relationship)
      check(
        macro.oil.trend !== 'neutral' && (expectedDir === 'SELL') === (macro.oil.trend === 'bullish'),
        `Oil ${macro.oil.trend} (${macro.oil.price.toFixed(0)}) — CAD ${macro.oil.trend === 'bullish' ? 'strengthening via energy' : 'weakening'} confirmed`,
        `Oil ${macro.oil.trend} — ${macro.oil.trend === 'neutral' ? 'no commodity signal for CAD' : 'oil direction conflicts with CAD trade'}`,
      );
      // SPX: USD/CAD inversely correlated with US equities during risk-on
      check(
        macro.spx.trend !== 'neutral' && (expectedDir === 'SELL') === (macro.spx.trend === 'bullish'),
        `SPX ${macro.spx.trend} — risk-on capital flows support CAD, USD/CAD bearish`,
        `SPX ${macro.spx.trend} — equity signal not supporting CAD direction`,
      );
    }

    // ── USD/CHF profile: Gold + FXF "quiet panic" ────────────────────────────
    if (pair === 'USD/CHF') {
      // Gold up = safe-haven bid = CHF up = sell USD/CHF
      check(
        macro.gold.trend !== 'neutral' && (expectedDir === 'SELL') === (macro.gold.trend === 'bullish'),
        `Gold ${macro.gold.trend} — safe-haven confirms CHF ${expectedDir === 'SELL' ? 'bid' : 'weakness'}`,
        `Gold ${macro.gold.trend} — safe-haven channel weak for USD/CHF trade`,
      );
      // FXF rising before VIX = "quiet panic" — CHF accumulation by smart money
      const fxf = macro.currencyStrength.find((cs) => cs.currency === 'CHF');
      if (fxf) {
        check(
          (expectedDir === 'SELL') === (fxf.trend === 'bullish'),
          `FXF (CHF ETF) ${fxf.trend} — smart money CHF positioning confirms ${expectedDir}`,
          `FXF ${fxf.trend} — CHF ETF flow conflicts with ${expectedDir} USD/CHF`,
        );
      }
      // DFII10: real yield direction = gold/CHF structural driver
      check(
        (expectedDir === 'SELL') === (fred.realYield.trend === 'falling'),
        `Real yield ${fred.realYield.latestValue.toFixed(2)}% ${fred.realYield.trend} — ${fred.realYield.trend === 'falling' ? 'negative real rates support CHF safe-haven bid' : 'real rates rising, safe-haven bid weakening'}`,
        `Real yield ${fred.realYield.trend} conflicts with ${expectedDir} USD/CHF`,
      );
    }

    // ── EUR/USD profile: DAX + DXY divergence ────────────────────────────────
    if (pair === 'EUR/USD') {
      // DAX bullish = European capital inflows = EUR bid
      check(
        macro.dax.trend !== 'neutral' && (expectedDir === 'BUY') === (macro.dax.trend === 'bullish'),
        `DAX ${macro.dax.trend} — European capital flow confirms EUR ${expectedDir === 'BUY' ? 'bid' : 'offered'}`,
        `DAX ${macro.dax.trend} — European equity flow conflicts or neutral`,
      );
      // DXY inversely: if DXY bearish, EUR/USD BUY is confirmed; DXY bullish = headwind
      check(
        (expectedDir === 'BUY') === (macro.dxy.trend === 'bearish'),
        `DXY ${macro.dxy.trend} — USD direction ${macro.dxy.trend === 'bearish' ? 'confirms EUR/USD BUY' : 'confirms EUR/USD SELL'}`,
        `DXY ${macro.dxy.trend} — conflicts with ${expectedDir} EUR/USD`,
      );
    }

    // ── GBP/USD profile: FTSE + SPX ──────────────────────────────────────────
    if (pair === 'GBP/USD') {
      // FTSE bullish = UK equity strength = GBP demand
      check(
        macro.ftse.trend !== 'neutral' && (expectedDir === 'BUY') === (macro.ftse.trend === 'bullish'),
        `FTSE ${macro.ftse.trend} — UK equity flow confirms GBP ${expectedDir === 'BUY' ? 'bid' : 'offered'}`,
        `FTSE ${macro.ftse.trend} — UK equity flow conflicts or neutral`,
      );
      // GBP is risk-sensitive: SPX direction amplifies GBP moves
      check(
        macro.spx.trend !== 'neutral' && (expectedDir === 'BUY') === (macro.spx.trend === 'bullish'),
        `SPX ${macro.spx.trend} — global risk sentiment supports GBP ${expectedDir}`,
        `SPX ${macro.spx.trend} — risk sentiment conflicts with ${expectedDir} GBP/USD`,
      );
    }

    // ── USD/JPY profile: Nikkei + US10Y (the carry trade engine) ─────────────
    if (pair === 'USD/JPY') {
      // Nikkei bullish = risk-on Japan = JPY weakens = USD/JPY UP
      check(
        macro.nikkei.trend !== 'neutral' && (expectedDir === 'BUY') === (macro.nikkei.trend === 'bullish'),
        `Nikkei ${macro.nikkei.trend} — Japan risk-on: JPY ${macro.nikkei.trend === 'bullish' ? 'weakening' : 'bid'}. Confirms ${expectedDir}`,
        `Nikkei ${macro.nikkei.trend} — Nikkei signal conflicts or neutral for JPY`,
      );
      // US10Y: the carry trade driver. Rising yields = wider US-JP spread = USD/JPY UP
      check(
        macro.us10y.trend !== 'neutral' && (expectedDir === 'BUY') === (macro.us10y.trend === 'bullish'),
        `US10Y ${macro.us10y.trend} (${macro.us10y.price.toFixed(2)}%) — carry trade yield spread confirms ${expectedDir}`,
        `US10Y ${macro.us10y.trend} — yield spread conflicts with ${expectedDir} USD/JPY`,
      );
    }

    // ── GBP/JPY profile: Nikkei + HYG (risk-on amplifier) ────────────────────
    if (pair === 'GBP/JPY') {
      // Nikkei: Japan risk-on = JPY weakens (most powerful for JPY pairs)
      check(
        macro.nikkei.trend !== 'neutral' && (expectedDir === 'BUY') === (macro.nikkei.trend === 'bullish'),
        `Nikkei ${macro.nikkei.trend} — JPY ${macro.nikkei.trend === 'bullish' ? 'weakening' : 'strengthening'}. Confirms ${expectedDir}`,
        `Nikkei ${macro.nikkei.trend} — Japan signal conflicts or neutral for GBP/JPY`,
      );
      // HYG: GBP/JPY is extreme risk-on play — HYG falling = immediate SELL signal
      check(
        macro.hyg.trend !== 'neutral' && (expectedDir === 'BUY') === (macro.hyg.trend === 'bullish'),
        `HYG ${macro.hyg.trend} — credit risk appetite confirms ${expectedDir} GBP/JPY`,
        `HYG ${macro.hyg.trend} — ${macro.hyg.trend === 'bearish' ? 'smart money exiting risk. GBP/JPY BUY dangerous.' : 'credit neutral for GBP/JPY'}`,
      );
    }

    // ── Universal: HYG credit risk check for risk currencies ─────────────────
    // SPX can stay up for days while HYG is already falling (smart money exits first).
    // This divergence is a 48h early warning before equity crash hits AUD/NZD/GBP/CAD.
    const riskCurrencies = ['AUD', 'NZD', 'GBP', 'CAD'];
    if (riskCurrencies.includes(base) && pair !== 'GBP/JPY') {
      // Already covered GBP/JPY above
      const hygBullishOrNeutral = macro.hyg.trend !== 'bearish';
      const spxAligned = macro.spx.trend !== 'neutral' && (expectedDir === 'BUY') === (macro.spx.trend === 'bullish');
      // HYG+SPX divergence (SPX up but HYG down) = "Lie Detector" failure
      const divergence = macro.spx.trend === 'bullish' && macro.hyg.trend === 'bearish';
      if (divergence) {
        check(
          expectedDir === 'SELL',
          `SPX↑ + HYG↓ DIVERGENCE — smart money quietly exiting. ${base} BUY is a trap. SELL aligns with credit reality.`,
          `SPX↑ + HYG↓ DIVERGENCE — smart money quietly exiting. Avoid ${base} BUY. Equity rally is a lie.`,
        );
      } else {
        check(
          hygBullishOrNeutral && spxAligned,
          `HYG ${macro.hyg.trend} + SPX ${macro.spx.trend} — credit + equity confirm ${expectedDir} ${base}`,
          `HYG ${macro.hyg.trend} / SPX ${macro.spx.trend} — risk signal weak or conflicting for ${base}`,
        );
      }
    }

    const corrScore = total > 0 && confirming >= Math.ceil(total / 2) ? 1 : 0;
    return { corrScore, corrDetail: signals.join(' | ') };
  }

  private detectLiquidityTrap(
    pair: string,
    sentData: { signal: string; shortPct: number; longPct: number } | undefined,
    cotBias: 'bullish' | 'bearish' | null,
    sentShortPct: number,
    sentLongPct: number,
  ): string | null {
    if (!sentData || cotBias === null) return null;

    const crowdShortHeavy = sentShortPct >= 60;
    const crowdLongHeavy = sentLongPct >= 60;
    const cotSelling = cotBias === 'bearish';
    const cotBuying = cotBias === 'bullish';

    if (cotSelling && crowdShortHeavy) {
      return (
        `LIQUIDITY TRAP on ${pair}: Hedge funds AND ${sentShortPct.toFixed(0)}% of retail are SHORT. ` +
        `When everyone is on one side, market makers hunt stops upward first. ` +
        `Watch for a spike UP to a Supply zone — that is the real SELL entry, not now.`
      );
    }
    if (cotBuying && crowdLongHeavy) {
      return (
        `LIQUIDITY TRAP on ${pair}: Hedge funds AND ${sentLongPct.toFixed(0)}% of retail are LONG. ` +
        `When everyone is on one side, market makers hunt stops downward first. ` +
        `Watch for a spike DOWN to a Demand zone — that is the real BUY entry, not now.`
      );
    }
    return null;
  }

  private getExpectedDirection(
    base: string,
    quote: string,
    macro: Awaited<ReturnType<MacroService['getMacroData']>>,
    fred: Awaited<ReturnType<FredService['getFredData']>>,
  ): 'BUY' | 'SELL' {
    // ── USD composite bias (3 sources: DXY, yield curve, FRED fundamentals) ─────
    // Each source votes independently; majority wins
    let usdScore = 0;
    if (macro.usdBias === 'bullish') usdScore++;
    if (macro.usdBias === 'bearish') usdScore--;
    if (fred.usdFundamentalBias === 'bullish') usdScore++;
    if (fred.usdFundamentalBias === 'bearish') usdScore--;
    // Yield curve inversion = safe-haven USD regardless of other signals
    if (fred.yieldCurve.inverted) usdScore++;
    // US10Y trend as fast Fed expectations proxy
    if (macro.us10y.trend === 'bullish') usdScore++;
    if (macro.us10y.trend === 'bearish') usdScore--;
    // Real yield rising = tighter real conditions = USD bid
    if (fred.realYield.trend === 'rising') usdScore++;
    if (fred.realYield.trend === 'falling') usdScore--;
    // Liquidity contraction = structural USD safe-haven bid
    if (fred.liquidityRegime === 'contracting') usdScore++;
    if (fred.liquidityRegime === 'expanding') usdScore--;

    const netUsdBias = usdScore > 0 ? 'bullish' : usdScore < 0 ? 'bearish' : 'neutral';

    // ── Pairs involving USD ───────────────────────────────────────────────────
    if (base === 'USD') return netUsdBias === 'bearish' ? 'SELL' : 'BUY';
    if (quote === 'USD') return netUsdBias === 'bearish' ? 'BUY' : 'SELL';

    // ── PAIR-SPECIFIC R1 BASELINE: Regional drivers override generic risk logic ──
    // These are the "primary baseline" signals for each pair from their local drivers

    // EUR/USD: DAX (German equities) as primary driver of EUR strength
    if (base === 'EUR' && quote === 'USD') {
      const daxBullish = macro.dax.trend === 'bullish';
      // If DAX strong, EUR should be strong → BUY EUR/USD (against USD)
      // Adjust for USD bias: if USD strong, override DAX
      if (netUsdBias === 'bullish') return 'SELL'; // USD override
      return daxBullish ? 'BUY' : 'SELL';
    }

    // GBP/USD: FTSE (UK equities) as primary driver of GBP strength
    if (base === 'GBP' && quote === 'USD') {
      const ftseBullish = macro.ftse.trend === 'bullish';
      // If FTSE strong, GBP should be strong → BUY GBP/USD
      if (netUsdBias === 'bullish') return 'SELL'; // USD override
      return ftseBullish ? 'BUY' : 'SELL';
    }

    // AUD/USD & NZD/USD: Gold + Copper (commodity complex) as primary drivers
    if ((base === 'AUD' || base === 'NZD') && quote === 'USD') {
      // QT (Fed Balance Sheet contraction) kills commodity currencies
      if (fred.liquidityRegime === 'contracting') return 'SELL';
      const goldBullish = macro.gold.trend === 'bullish';
      const copperBullish = macro.copper.trend === 'bullish';
      // Gold and Copper bullish → commodity demand strong → AUD/NZD demand strong
      const commodityScore = (goldBullish ? 1 : 0) + (copperBullish ? 1 : 0);
      if (netUsdBias === 'bullish') return 'SELL'; // USD override
      return commodityScore >= 1 ? 'BUY' : 'SELL';
    }

    // USD/CAD: Oil (energy) as primary driver of CAD strength
    if (base === 'USD' && quote === 'CAD') {
      const oilBullish = macro.oil.trend === 'bullish';
      // Oil bullish → CAD strong → USD/CAD should SELL (buy CAD)
      // But USD bias can override
      if (netUsdBias === 'bearish') return 'SELL'; // BUY CAD
      if (netUsdBias === 'bullish') return 'BUY'; // USD override
      return oilBullish ? 'SELL' : 'BUY';
    }

    // USD/CHF: Gold (safe-haven) as primary driver of CHF strength
    if (base === 'USD' && quote === 'CHF') {
      const goldBullish = macro.gold.trend === 'bullish';
      // Gold bullish → safe-haven demand → CHF strong → USD/CHF SELL (buy CHF)
      if (netUsdBias === 'bullish') return 'BUY'; // USD override
      return goldBullish ? 'SELL' : 'BUY';
    }

    // ── Cross pairs — driven by risk environment + private drivers ────────────
    const riskCurrencies = ['AUD', 'NZD', 'GBP', 'CAD'];
    const safeCurrencies = ['JPY', 'CHF'];

    // GBP/JPY — governed by global risk + HYG early warning
    // If HYG is falling (smart money leaving risk), JPY safe-haven bid = SELL GBP/JPY
    if (base === 'GBP' && quote === 'JPY') {
      const hygWarning = macro.hyg.trend === 'bearish';
      const riskOn = macro.riskEnvironment === 'risk-on' && !hygWarning;
      return riskOn ? 'BUY' : 'SELL';
    }

    // Generic cross: risk currency base vs safe quote (fallback)
    if (riskCurrencies.includes(base) && safeCurrencies.includes(quote)) {
      return macro.riskEnvironment === 'risk-on' ? 'BUY' : 'SELL';
    }
    if (safeCurrencies.includes(base) && riskCurrencies.includes(quote)) {
      return macro.riskEnvironment === 'risk-on' ? 'SELL' : 'BUY';
    }

    return 'BUY';
  }

  private checkWeeklyTrendAlignment(
    base: string,
    quote: string,
    expectedDir: 'BUY' | 'SELL',
    macro: Awaited<ReturnType<MacroService['getMacroData']>>,
  ): boolean {
    const usdIsBase = base === 'USD';
    const usdIsQuote = quote === 'USD';

    // ── USD pairs: DXY weekly trend is the primary filter ────────────────────
    if (usdIsBase || usdIsQuote) {
      const dxyBullish = macro.dxy.trend === 'bullish';
      const usdBullishExpected = (usdIsBase && expectedDir === 'BUY') || (usdIsQuote && expectedDir === 'SELL');
      return dxyBullish === usdBullishExpected;
    }

    // ── Risk currencies (AUD, NZD, GBP, CAD): risk environment + HYG ────────
    // HYG divergence (SPX up but HYG falling) = weekly trend is a LIE.
    // Smart money already positioned for reversal → block BUY of risk currencies.
    const riskCurrencies = ['AUD', 'NZD', 'GBP', 'CAD'];
    if (riskCurrencies.includes(base)) {
      const hygDivergence = macro.spx.trend === 'bullish' && macro.hyg.trend === 'bearish';
      if (hygDivergence && expectedDir === 'BUY') return false; // Lie Detector fails weekly trend
      return macro.riskEnvironment === 'risk-on' ? expectedDir === 'BUY' : expectedDir === 'SELL';
    }

    // ── JPY crosses without USD ───────────────────────────────────────────────
    // e.g. GBP/JPY — Nikkei weekly direction is the anchor
    if (quote === 'JPY') {
      return macro.nikkei.trend !== 'neutral'
        ? (expectedDir === 'BUY') === (macro.nikkei.trend === 'bullish')
        : true;
    }

    return true;
  }

  private buildWatchlistReason(
    pair: string,
    expectedDir: 'BUY' | 'SELL',
    killSwitches: KillSwitch[],
    dangerZoneBlock: boolean,
    dangerZoneMessage: string | null,
  ): string {
    if (dangerZoneBlock) {
      return `${pair}: ${dangerZoneMessage ?? 'Danger zone active'}. Re-evaluate 30 min after event.`;
    }
    const failed = killSwitches.filter((k) => !k.passed);
    return `${pair} ${expectedDir}: ${failed.map((k) => k.unlockCondition ?? k.name).join(' | ')}`;
  }

  private buildRecommendation(
    pair: string,
    direction: 'BUY' | 'SELL' | 'WATCH' | 'NO TRADE',
    effectiveDir: 'BUY' | 'SELL',
    score: number,
    killSwitches: KillSwitch[],
    dangerZone: boolean,
    dangerZoneMessage: string | null,
    watchlistReason: string | null,
  ): string {
    if (direction === 'WATCH') {
      const failed = killSwitches.filter((k) => !k.passed);
      const blocker = dangerZone
        ? dangerZoneMessage ?? 'Danger zone active'
        : failed.map((k) => k.name).join(', ');
      return (
        `Score ${score}/5 — setup valid for ${effectiveDir} ${pair} but blocked by: ${blocker}. ` +
        `Add to watchlist. ${watchlistReason ?? ''}`
      );
    }
    if (direction === 'NO TRADE') {
      return `Score ${score}/5 — insufficient confluence for ${pair}. Need ≥3 pts. Stand aside.`;
    }
    const zoneType = direction === 'BUY' ? 'Demand (Drop-Base-Rally)' : 'Supply (Rally-Base-Drop)';
    return (
      `Score ${score}/5 — ${direction} ${pair}. ` +
      `Go to D1/H4 chart and find a fresh ${zoneType} zone. ` +
      `Wait for price to enter the zone, confirm with H4 CHOCH, then place limit order.`
    );
  }

  private getWeeklyProfile(): string {
    const day = new Date().getDay();
    switch (day) {
      case 1: return 'MONDAY — Judas Swing likely. Expect a fake move opposite to true trend. DO NOT chase Monday breakouts. Wait for the sweep before entering.';
      case 2: return 'TUESDAY — Judas Swing may continue. Weekly High/Low often forms tonight. Watch for reversal at key S&D zones after a sweep.';
      case 3: return 'WEDNESDAY — True trend likely emerging. High or Low of the week usually set by now. Best day to enter swing trades with full confluence.';
      case 4: return 'THURSDAY — Expansion phase. Price should be running toward the weekly target. Hold open trades; consider trailing stop.';
      case 5: return 'FRIDAY — Reduce or close positions before weekend. Gap risk on Sunday open. Avoid new swing entries today.';
      case 6: return "SATURDAY — Markets closed. Draw D1 S&D zones for next week. Review this week's trade outcomes.";
      case 0: return 'SUNDAY — Pre-week preparation. Check DXY/SPX weekly direction, draw D1 zones, review the economic calendar for high-impact events.';
      default: return '';
    }
  }

  private buildSummary(
    macro: Awaited<ReturnType<MacroService['getMacroData']>>,
    fred: Awaited<ReturnType<FredService['getFredData']>>,
    sorted: PairScore[],
  ): string {
    const top = sorted.find((p) => p.direction === 'BUY' || p.direction === 'SELL');
    const watch = sorted.find((p) => p.direction === 'WATCH');
    const hygDivergence = macro.spx.trend === 'bullish' && macro.hyg.trend === 'bearish';
    const vvixAlert = macro.vvix && macro.vvix.price > 110 ? ' ⚠ VVIX PRE-PANIC' : '';
    const skewAlert = macro.skew && macro.skew.price > 140 && macro.vix.price < 20 ? ' ⚠ SKEW TAIL HEDGING' : '';
    const eemAlert = macro.eem && macro.eem.trend === 'bearish' ? ' ⚠ EEM CAPITAL FLIGHT' : '';
    return (
      `USD: ${macro.usdBias.toUpperCase()} (DXY ${macro.dxy.trend} | Real Yield ${fred.realYield.latestValue.toFixed(2)}% ${fred.realYield.trend} | 2Y ${fred.us2y.latestValue.toFixed(2)}% ${fred.us2y.trend} | 10Y ${macro.us10y.price.toFixed(2)}% ${macro.us10y.trend}). ` +
      `Liquidity: ${fred.liquidityRegime.toUpperCase()}. ` +
      `Risk: ${macro.riskEnvironment.toUpperCase()}${hygDivergence ? ' ⚠ SPX/HYG DIVERGENCE' : ''}${vvixAlert}${skewAlert}${eemAlert}. ` +
      `Fed: ${fred.centralBankBias.toUpperCase()}. ` +
      `Gold: ${macro.gold.trend} | Oil: ${macro.oil.trend} | Copper: ${macro.copper.trend} | HYG: ${macro.hyg.trend}. ` +
      (top
        ? `Best setup: ${top.direction} ${top.pair} (${top.totalScore}/5).`
        : watch
          ? `No live setup — top watchlist: ${watch.pair} (${watch.totalScore}/5, kill switch blocked).`
          : 'No setup or watchlist candidate found.')
    );
  }
}
