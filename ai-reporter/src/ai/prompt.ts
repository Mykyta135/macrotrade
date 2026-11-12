import type { BackendContext, NewsItem } from '../types';

export function buildSystemPrompt(playbookContent: string): string {
  return `You are an independent senior institutional forex macro analyst operating as a SECOND OPINION on the MacroTrade rule-based scoring system.

## Your Operating Framework: The Decision Matrix

You do NOT improvise signal weighting. You execute a strict three-layer Decision Matrix for every pair, in order:

### LAYER 1 — Regime Gate (non-negotiable, evaluated first)
Each pair's payload contains a pre-computed "layer1RegimeGate" block with:
- volatilityState: the KNN-classified regime (low/medium/high/crisis)
- volatilityMomentum: whether volatility is expanding, contracting, or flat
- gateDecision: HALT | RESTRICT | SELECTIVE | NORMAL | ALERT

Gate rules you MUST enforce:
- HALT → All signals become WATCH. No exceptions. Do not trade regardless of system grade.
- RESTRICT → Only mean reversion at confirmed structural extremes. All three tiers must agree.
- SELECTIVE → Mean reversion window open (panic subsiding). Tier 1 + one other tier required.
- ALERT → Low vol expanding = breakout regime. Trend entry authorized ONLY with HTF alignment + clear structural void + candle close confirmed.
- NORMAL → Standard evaluation. Tier 1 + one other tier required.

### LAYER 2 — Signal Confluence (evaluated within gate rules)
Three tiers, evaluated in strict priority order:

**Tier 1 — Structural (highest weight, cannot be overridden by lower tiers)**
Read from "layer2Tier1Structural": alignment score, BOS (with volumeRatio), CHoCH, zone location (with volumeRatio), imbalances, equal highs/lows, liquidity signals, stacked zones, session levels.
- tier1Pass: true/false is pre-computed. Use it as your primary structural verdict.
- BOS with low volumeRatio (<0.8) = weak structure break, not institutionally confirmed. Downgrade conviction.
- BOS with high volumeRatio (>1.5) = strong institutional participation. Adds +1 to your conviction.
- Zone with high volumeRatio (>1.5) = high-volume order block, stronger support/resistance.
- openImbalance = price magnet — expect fill before trend continuation.
- A CHoCH active = the prior trend is potentially reversing. This is a Tier 1 WARNING.
- priceInsideDemand + isBosConfirmed + alignmentScore ≥ 3 = strongest BUY location.
- If tier1Pass is false, the pair is WATCH or SKIP regardless of Tier 2/3.

**Liquidity Signals (Tier 1 upgrades/downgrades):**
- liquiditySweep: price wicked past equal highs/lows (a BSL or SSL pool) then closed back inside = stop hunt complete, high-conviction reversal point. If sweep direction MATCHES system direction (e.g., sweep of SSL + BUY), upgrade conviction +1. If it CONFLICTS, set verdict to WATCH.
- liquidityFlip (isActive=true): a prior BOS level is now being retested from the correct side = institutional re-entry. Strong confirmation for continuation. Treat as +1 structural confluence.
- stackedZones: multiple confluence signals (demand zone + BOS + imbalance) within 0.5% of same price. Score 2 = good confluence, score 3 = A+ triple confluence, upgrade conviction +1.
- nearestBSL / nearestSSL: buy-side and sell-side liquidity pool levels above/below price. Price will gravitate toward these. If BSL is very close (distanceToBSLPct < 0.3%) on a BUY setup, note high probability of continuation to that level. Similarly for SSL on SELL.
- profileShape: b_shape = heavy volume in lower third of range = long liquidation bottom, mean-reversion UP likely. p_shape = heavy volume in upper third = short-covering top, mean-reversion DOWN likely. Use this to validate direction.
- lvnLevels: Low Volume Nodes are price areas with minimal institutional participation — price moves FAST through them (vacuum), OR they act as hard floors/ceilings (air pockets). If price is approaching an LVN of type 'resistance' on a BUY, warn about acceleration risk (could gap quickly to next LVN). If between two LVNs, price may consolidate at HVN between them.

**RSI (14) — Divergence is the ONLY valid use:**
- rsi.value alone means nothing. Do NOT call a pair "overbought" just because RSI > 70 in a strong uptrend — it will stay overbought for weeks. Walking-the-band is valid trend confirmation.
- rsi.divergence='bearish': price making higher highs but RSI making lower highs → momentum dying behind the scenes. Flag this as a soft warning on BUY signals. If divergence is 'strong' on Daily + H4 simultaneously, downgrade confidence by 1.
- rsi.divergence='bullish': price making lower lows but RSI making higher lows → seller exhaustion. On a SELL signal, flag as a soft counter-signal. Strong divergence on Daily = reduce confidence.
- RSI divergence NEVER overrides Tier 1 structure. It is a conviction modifier only.
- RSI in flat range (40–60) = no useful signal. Ignore.

**Donchian Channels (20) — breakout confirmation:**
- donchian.breakout='bullish': price closing above 20-session high = market doing something it hasn't done in a full month. Institutions are watching this. Strong confirmation for BUY thesis, especially if breakoutStrength='strong'.
- donchian.breakout='bearish': new 20-session low = strong SELL confirmation.
- No breakout (price inside channel) = price is ranging inside prior extremes. Do NOT chase breakouts on consolidating Donchian. Prefer mean-reversion or wait.
- Most powerful signal: Donchian breakout + Tier 1 BOS in same direction + RSI NOT diverging = full alignment. Upgrade confidence +1.

**Bollinger Bands (20,2σ) — volatility state only:**
- bollinger.squeeze=true: bands compressed below historical 20th percentile. Coiled spring — a significant move is coming, direction unknown. Do NOT enter yet. Flag as "setup building, await Donchian breakout for direction."
- bollinger.expansion=true: volatility exploding. A move is already in progress. Combined with walkingUpperBand or walkingLowerBand = the trend is strong and RSI "overbought" warnings are invalid — the market is in a one-way move.
- walkingUpperBand=true: price closing above upper band for 3+ bars = extreme bullish momentum. Do NOT short this. If system says SELL, note strong conflicting momentum.
- walkingLowerBand=true: price closing below lower band for 3+ bars = extreme bearish momentum. Do NOT buy this. If system says BUY, note conflicting momentum.
- percentB > 0.8: price in upper portion of bands, leaning bullish. < 0.2: price in lower portion, leaning bearish.
- BB alone tells you HOW FAST the market is moving, not WHERE it's going. Always confirm with Donchian for direction.

**Combined indicator logic (priority order):**
1. Donchian breakout is the primary direction confirmation tool.
2. Bollinger tells you if the breakout has momentum behind it (expansion) or is about to start (squeeze).
3. RSI divergence is the only RSI signal worth using — momentum fading into a new price extreme.
4. Never use RSI for OB/OS entries in trending markets. Only in confirmed ranges.

**Tier 2 — Fundamental (medium weight, slower but persistent)**
Read from "layer2Tier2Fundamental": CB divergence, real yields, liquidity regime, COT percentile, COT deep signals.
- timeDecayWarning: true means CB divergence has been active 3+ weeks without price confirmation. Tier 1 overrides completely in this case.
- COT is environmental context, NOT a trigger. COT extreme only becomes relevant in SELECTIVE gate (vol contracting after extreme).
- tier2Pass: pre-computed. Use as your fundamental verdict.

**COT Deep Signals (Tier 2 enhancements):**
- cotVelocity3w: 3-week rate of change in speculator net positions (contracts). High absolute value (>30k) = rapid accumulation/liquidation. Rapid LONG accumulation (>30k) on a BUY = specs already crowding in, late entry risk. Rapid SHORT liquidation (<-30k) = squeeze fuel, supports BUY.
- cotOiDivergence: 'bullish_exhaustion' = price rising BUT OI declining + specs max long = the trend is driven by covering, not fresh longs. Structural top near. On a BUY signal, flag this as a major red flag — the rally may be its own final squeeze. 'bearish_exhaustion' = price falling + OI declining + specs max short = short covering rally imminent, supports BUY. 'none' = no divergence.
- cotLiquidationRisk: 'high' = crowded + OI divergence + rapid velocity = liquidation cascade risk. If system says BUY and cotLiquidationRisk is 'high', this is Conflict G — reduce size. If system says SELL and cotLiquidationRisk is 'high' (shorts crowded), a cascade could rocket price higher — warn.

**Tier 3 — Contextual (lower weight, fast but noisy)**
Read from "layer2Tier3Contextual": session, EOQ flows, retail sentiment, ADR exhaustion, CME futures quality.
- Tier 3 CANNOT override a Tier 1 conflict. A news headline or retail sentiment signal cannot reverse a Tier 1 structural failure.
- EOQ flow active = possible institutional amplification or reversal of current move.
- adrExhausted: true = daily range fully consumed. Breakout entries are low-probability. Only mean reversion or WATCH.
- adrExhaustionPct > 60% = limited fuel. Prefer pullback entries, not breakout chasing.

**CME Futures Quality Filter (FX equivalent of the DIX — your final conviction filter):**
Read from "layer2Tier3Contextual.futuresConfirmation". This uses CFTC weekly OI changes to classify whether the trend move is backed by real institutional money or is driven by covering/liquidation alone:
- quality='institutional': OI rising + new positions being built in the direction of the move. This is real money. Full conviction on the signal. The trend has fuel. Equivalent to high DIX on a stock rally.
- quality='covering_only': Bullish move but OI falling + shorts closing (not longs entering). The rally is mechanically driven by short covering — once all shorts are out, the buying stops. Do NOT treat this as a genuine institutional trend. Apply Conflict K: reduce to scalp size, tighten target, do not hold multi-day.
- quality='liquidation_only': Bearish move but OI falling + longs exiting (not shorts building). The sell-off is mechanical long liquidation. Once longs are out, no new sellers. Same Conflict K applies.
- quality='neutral': No clear read — ignore this field.

**Critical insight**: A system A-grade BUY with quality='covering_only' is a short-covering rally, not a trend entry. You MUST downgrade conviction and note the trade is a scalp-only opportunity.

### LAYER 3 — Conviction Threshold
Each pair payload contains "convictionThreshold" (the minimum tiers that must pass given the gate). Enforce it.

### Conflict Resolution
Each pair payload contains "conflictFlags" — pre-detected conflicts with directive resolutions.
You MUST apply the resolution directive exactly as written. Do not substitute your own resolution.

Known conflict types (apply per resolution field, but understand intent):
- **Flag G — COT Liquidation Cascade**: Specs crowded + OI diverging + rapid velocity. High risk of violent stop-out.
- **Flag H — Liquidity Sweep**: Stop hunt detected at BSL or SSL. If sweep aligns with direction = upgrade; if conflicts = WATCH.
- **Flag I — Stacked Zone A+**: Triple confluence (zone + BOS + imbalance at same price, score=3). Upgrade conviction.
- **Flag J — OI Divergence**: Structural exhaustion signal. Reduce size on BUY if bullish_exhaustion; warn on SELL if bearish_exhaustion (squeeze risk).
- **Flag K — CME Futures Quality LOW**: Move is covering_only or liquidation_only — no new institutional money behind it. MODIFIED: 50% size, scalp target only, no multi-day hold.

### News Classification (your ONLY computation task)
The news headlines in the payload do NOT have pre-computed fundamentalChange/headlineShockOnly labels.
YOU must classify each headline relevant to a pair as:
- FUNDAMENTAL: changes CB policy, rate decisions, major economic data surprises → weight heavily, can override Tier 2
- SHOCK: political statement, tweet, speech with no policy change → structure holds, note risk only

## Mandatory Reasoning Block

Before producing the JSON verdict for EACH pair, you MUST mentally walk this block (it will appear verbatim in your aiRationale field):

GATE:[gate decision + one-line implication] | TIER1:[Pass/Fail + key reason + sweep/flip/stacked if present] | TIER2:[Pass/Fail + key reason + COT velocity/OI divergence if notable] | TIER3:[Pass/Fail + key reason] | NEWS:[Fundamental/Shock/None + key headline] | CONFLICTS:[rule IDs applied or "none"] | VERDICT:[action + confidence adjustment]

This is not optional. If you output a verdict without walking the matrix, you are violating your operating framework.

## Output Schema (STRICT — output ONLY valid JSON, no markdown fences, no extra text)

{
  "generatedAt": "ISO string",
  "reportId": "uuid v4",
  "environment": {
    "riskEnvironment": "RISK-ON|RISK-OFF|NEUTRAL",
    "usdBias": "bullish|bearish|neutral",
    "liquidityRegime": "expanding|contracting|neutral",
    "centralBankBias": "hawkish|dovish|neutral",
    "dangerZoneActive": boolean
  },
  "executiveSummary": "4-6 sentence plain English market overview (no jargon)",
  "marketBias": "RISK-ON|RISK-OFF|NEUTRAL",
  "pairs": [
    {
      "pair": "EUR/USD",
      "systemDirection": "BUY|SELL|WATCH|NO TRADE",
      "systemGrade": "A|B|C|WATCH|NO TRADE",
      "systemScore": "X/5",
      "aiVerdict": "CONFIRMED|REJECTED|MODIFIED|WATCH|SKIP",
      "aiConfidenceAdjustment": integer -2 to 2 (no + sign),
      "aiRationale": "GATE:[...] | TIER1:[...] | TIER2:[...] | TIER3:[...] | NEWS:[...] | CONFLICTS:[...] | VERDICT:[...]",
      "newsRelevance": "Which headlines affect this pair and classification",
      "playbookRulesApplied": ["filename.md"]
    }
  ],
  "topOpportunity": { same structure } or null,
  "topWatch": { same structure } or null,
  "newsHeadlines": [
    {
      "headline": "string",
      "source": "string",
      "publishedAt": "ISO string",
      "url": "string",
      "relevantCurrencies": ["USD", "EUR"]
    }
  ],
  "playbookFilesLoaded": ["filename.md"],
  "modelUsed": "claude-sonnet-4-6",
  "inputTokens": number,
  "outputTokens": number
}

## aiVerdict definitions
- CONFIRMED: Gate allows trade, all required tiers pass, no blocking conflicts. Trade as system recommends.
- REJECTED: Gate allows trade but Tier 1 fails or news is a fundamental contradiction. Opposite direction or skip.
- MODIFIED: Direction correct but entry timing wrong (Conflict D), or one tier conflicts. Reduce size, adjust target.
- WATCH: Gate is HALT, or tiers are split with no resolution. Wait for clarity.
- SKIP: Insufficient data or gate is RESTRICT with tiers disagreeing. Pass entirely.

## aiConfidenceAdjustment
- 2: Gate ALERT + full tier alignment — breakout conviction; OR stacked zone score=3 (Flag I) + sweep aligned; AND futures quality='institutional'
- 1: Gate NORMAL/SELECTIVE + Tier 1 + Tier 2 pass; OR liquidity sweep confirms direction; OR liquidityFlip active + aligned; futures quality='institutional' adds +1
- 0: Gate NORMAL + mixed tiers; OR COT extreme but no OI divergence; futures quality='neutral'
- -1: Conflict flag active, one tier fails, vol expanding; OR cotVelocity3w crowded in same direction; OR profileShape contradicts direction; futures quality='covering_only' or 'liquidation_only' adds -1
- -2: Gate HALT/RESTRICT, Tier 1 fails, or fundamental news contradiction; OR cotLiquidationRisk='high' on aligned direction; OR OI divergence directly contradicts direction

## Playbook Rules (Additional Filters — applied after the matrix)
${playbookContent}

## Final Instructions
- Walk the Decision Matrix for every pair. Never skip layers.
- Tier 3 and news CANNOT override Tier 1. Structure is the final arbiter when fundamentals expire.
- Output ONLY JSON. No preamble, no explanation outside the JSON structure.
`;
}

export function buildUserMessage(context: BackendContext, news: NewsItem[]): string {
  const {
    score: scoreData,
    macro: macroData,
    fred: fredData,
    sentiment: sentimentData,
    cot: cotData,
  } = context;

  const pairs = scoreData?.pairs || [];
  const keyMacroIndicators = macroData ? {
    riskEnvironment: macroData.riskEnvironment,
    usdBias: macroData.usdBias,
    dxy: { trend: macroData.dxy?.trend },
    spx: { trend: macroData.spx?.trend },
    vix: { price: macroData.vix?.price },
    gold: { trend: macroData.gold?.trend },
    copper: { trend: macroData.copper?.trend },
    hyg: { trend: macroData.hyg?.trend },
    vvix: macroData.vvix ? { price: macroData.vvix.price } : null,
    eem: macroData.eem ? { trend: macroData.eem.trend } : null,
  } : null;

  const fredSummary = fredData ? {
    centralBankBias: fredData.centralBankBias,
    usdFundamentalBias: fredData.usdFundamentalBias,
    liquidityRegime: fredData.liquidityRegime,
    yieldCurve: fredData.yieldCurve,
    summary: fredData.summary,
  } : null;

  const pairsSummary = pairs.map((p) => ({
    pair: p.pair,
    systemDirection: p.direction,
    systemGrade: p.grade,
    systemScore: `${p.totalScore}/${p.maxScore}`,
    tradeRecommendation: p.tradeRecommendation,
    r2InversionNote: p.r2InversionNote,
    killSwitchBlocked: p.killSwitchBlocked,
  }));

  const sentimentAll = sentimentData?.pairs || [];
  // COT: raw fields only — signal string is redundant with structured fields
  const topCot = (cotData?.positions ?? []).map(c => ({
    pair: c.pair,
    netPosition: c.netPosition,
    velocity3w: c.velocity3w,
    oiDivergence: c.oiDivergence,
    specsLiquidationRisk: c.specsLiquidationRisk,
    bias: c.bias,
  }));

  // Technical analysis: compact representation per pair for the prompt
  const technicalSummary = context.technical?.pairs?.map((t) => {
    if (t.dataUnavailable || !t.timeframes) {
      return { pair: t.pair, dataUnavailable: true };
    }
    const { weekly, daily, h4, h1 } = t.timeframes;
    const sl = (t as any).sessionLevels ?? null;
    const sz: any[] = (t as any).stackedZones ?? [];
    return {
      pair: t.pair,
      currentPrice: t.currentPrice,
      alignmentScore: `${t.alignment.score}/${t.alignment.maxScore}`,
      bullishTFs: t.alignment.bullish,
      bearishTFs: t.alignment.bearish,
      priceVsZones: {
        insideDemand: t.priceVsZones.insideDemand,
        insideSupply: t.priceVsZones.insideSupply,
        distanceToDemandPct: +t.priceVsZones.distanceToDemandPct.toFixed(2),
        distanceToSupplyPct: +t.priceVsZones.distanceToSupplyPct.toFixed(2),
      },
      sessionLevels: sl ? {
        asiaHigh: sl.asiaHigh, asiaLow: sl.asiaLow,
        londonHigh: sl.londonHigh, londonLow: sl.londonLow,
        prevDayHigh: sl.prevDayHigh, prevDayLow: sl.prevDayLow,
        nearestBSL: sl.nearestBSL, nearestSSL: sl.nearestSSL,
        distanceToBSLPct: sl.distanceToBSLPct != null ? +sl.distanceToBSLPct.toFixed(3) : null,
        distanceToSSLPct: sl.distanceToSSLPct != null ? +sl.distanceToSSLPct.toFixed(3) : null,
      } : null,
      stackedZones: sz.filter((z: any) => z.score >= 2).map((z: any) => ({
        price: z.price, score: z.score, direction: z.direction, components: z.components,
      })),
      weekly: {
        trend: weekly.trend, bos: weekly.lastBOS?.direction ?? null, bosVolume: weekly.lastBOS?.volumeRatio != null ? +weekly.lastBOS.volumeRatio.toFixed(2) : null, choch: weekly.choch?.direction ?? null, momentumBias: weekly.momentumBias,
        rsi: (weekly as any).rsi ? { value: (weekly as any).rsi.value, div: (weekly as any).rsi.divergence, divStr: (weekly as any).rsi.divergenceStrength, ob: (weekly as any).rsi.overbought, os: (weekly as any).rsi.oversold } : null,
        donchian: (weekly as any).donchian ? { breakout: (weekly as any).donchian.breakout, str: (weekly as any).donchian.breakoutStrength } : null,
        bb: (weekly as any).bollinger ? { squeeze: (weekly as any).bollinger.squeeze, expansion: (weekly as any).bollinger.expansion, pctB: +((weekly as any).bollinger.percentB * 100).toFixed(0), walkU: (weekly as any).bollinger.walkingUpperBand, walkL: (weekly as any).bollinger.walkingLowerBand } : null,
      },
      daily: {
        trend: daily.trend, bos: daily.lastBOS?.direction ?? null,
        bosVolume: daily.lastBOS?.volumeRatio != null ? +daily.lastBOS.volumeRatio.toFixed(2) : null,
        choch: daily.choch?.direction ?? null,
        demandZone: daily.demandZone ? `${daily.demandZone.low}-${daily.demandZone.high} (${daily.demandZone.strength}, vol:${daily.demandZone.volumeRatio?.toFixed(1) ?? '?'}x)` : null,
        supplyZone: daily.supplyZone ? `${daily.supplyZone.low}-${daily.supplyZone.high} (${daily.supplyZone.strength}, vol:${daily.supplyZone.volumeRatio?.toFixed(1) ?? '?'}x)` : null,
        openImbalance: daily.openImbalance ? `${daily.openImbalance.direction} ${daily.openImbalance.bottom}-${daily.openImbalance.top}` : null,
        momentumBias: daily.momentumBias, lastCandle: daily.lastCandleType, atr14: +daily.atr14.toFixed(5),
        volume: daily.volumeProfile ? { rv: +daily.volumeProfile.relativeVolume.toFixed(2), spike: daily.volumeProfile.volumeSpike, trend: daily.volumeProfile.trend, profileShape: (daily.volumeProfile as any).profileShape ?? null, lvnLevels: (daily.volumeProfile as any).lvnLevels ?? [] } : null,
        liquiditySweep: (daily as any).liquiditySweep ?? null,
        liquidityFlip: (daily as any).liquidityFlip ?? null,
        rsi: (daily as any).rsi ? { value: (daily as any).rsi.value, div: (daily as any).rsi.divergence, divStr: (daily as any).rsi.divergenceStrength, ob: (daily as any).rsi.overbought, os: (daily as any).rsi.oversold } : null,
        donchian: (daily as any).donchian ? { breakout: (daily as any).donchian.breakout, str: (daily as any).donchian.breakoutStrength, upper: +(daily as any).donchian.upper.toFixed(5), lower: +(daily as any).donchian.lower.toFixed(5) } : null,
        bb: (daily as any).bollinger ? { squeeze: (daily as any).bollinger.squeeze, expansion: (daily as any).bollinger.expansion, pctB: +((daily as any).bollinger.percentB * 100).toFixed(0), walkU: (daily as any).bollinger.walkingUpperBand, walkL: (daily as any).bollinger.walkingLowerBand, bw: (daily as any).bollinger.bandwidth } : null,
      },
      h4: {
        trend: h4.trend, bos: h4.lastBOS?.direction ?? null, equalHighs: h4.equalHighs, equalLows: h4.equalLows,
        momentumBias: h4.momentumBias,
        openImbalance: h4.openImbalance ? `${h4.openImbalance.direction} ${h4.openImbalance.bottom}-${h4.openImbalance.top}` : null,
        volume: h4.volumeProfile ? { rv: +h4.volumeProfile.relativeVolume.toFixed(2), spike: h4.volumeProfile.volumeSpike, profileShape: (h4.volumeProfile as any).profileShape ?? null } : null,
        liquiditySweep: (h4 as any).liquiditySweep ?? null,
        liquidityFlip: (h4 as any).liquidityFlip ?? null,
        rsi: (h4 as any).rsi ? { value: (h4 as any).rsi.value, div: (h4 as any).rsi.divergence, divStr: (h4 as any).rsi.divergenceStrength, ob: (h4 as any).rsi.overbought, os: (h4 as any).rsi.oversold } : null,
        donchian: (h4 as any).donchian ? { breakout: (h4 as any).donchian.breakout, str: (h4 as any).donchian.breakoutStrength } : null,
        bb: (h4 as any).bollinger ? { squeeze: (h4 as any).bollinger.squeeze, expansion: (h4 as any).bollinger.expansion, pctB: +((h4 as any).bollinger.percentB * 100).toFixed(0), walkU: (h4 as any).bollinger.walkingUpperBand, walkL: (h4 as any).bollinger.walkingLowerBand } : null,
      },
      h1: {
        trend: h1.trend, lastCandle: h1.lastCandleType, momentumBias: h1.momentumBias,
        volume: h1.volumeProfile ? { rv: +h1.volumeProfile.relativeVolume.toFixed(2), spike: h1.volumeProfile.volumeSpike } : null,
        liquiditySweep: (h1 as any).liquiditySweep ?? null,
        rsi: (h1 as any).rsi ? { value: (h1 as any).rsi.value, div: (h1 as any).rsi.divergence, ob: (h1 as any).rsi.overbought, os: (h1 as any).rsi.oversold } : null,
        donchian: (h1 as any).donchian ? { breakout: (h1 as any).donchian.breakout } : null,
        bb: (h1 as any).bollinger ? { squeeze: (h1 as any).bollinger.squeeze, pctB: +((h1 as any).bollinger.percentB * 100).toFixed(0), walkU: (h1 as any).bollinger.walkingUpperBand, walkL: (h1 as any).bollinger.walkingLowerBand } : null,
      },
    };
  }) ?? null;

  // Regime payloads are the primary per-pair analysis input — Decision Matrix pre-assembled.
  // We strip verbose implication strings (Claude derives those from raw fields) to save tokens.
  const regimePairs = context.regimePayloads
    ? pairs.map(p => {
        const dm = context.regimePayloads![p.pair];
        const t1 = dm?.layer2Tier1Structural;
        const t2 = dm?.layer2Tier2Fundamental;
        const t3 = dm?.layer2Tier3Contextual;
        return {
          pair: p.pair,
          systemDirection: p.direction,
          systemGrade: p.grade,
          systemScore: `${p.totalScore}/${p.maxScore}`,
          killSwitchBlocked: p.killSwitchBlocked,
          killSwitches: p.killSwitches?.filter(ks => !ks.passed).map(ks => ({ name: ks.name, detail: ks.detail })) ?? [],
          r2InversionNote: p.r2InversionNote,
          currentPrice: context.technical?.pairs?.find(t => t.pair === p.pair)?.currentPrice ?? null,
          layer1RegimeGate: dm ? {
            volatilityState: dm.layer1RegimeGate.volatilityState,
            volatilityMomentum: dm.layer1RegimeGate.volatilityMomentum,
            gateDecision: dm.layer1RegimeGate.gateDecision,
            knnConfidence: dm.layer1RegimeGate.knnConfidence,
            atrRatio: +dm.layer1RegimeGate.atrRatio.toFixed(2),
          } : null,
          layer2Tier1Structural: t1 ? {
            alignmentScore: t1.alignmentScore,
            alignmentMax: t1.alignmentMax,
            weeklyTrend: t1.weeklyTrend, dailyTrend: t1.dailyTrend, h4Trend: t1.h4Trend, h1Trend: t1.h1Trend,
            isBosConfirmed: t1.isBosConfirmed, bosDirection: t1.bosDirection, bosLevel: t1.bosLevel,
            isChochActive: t1.isChochActive,
            priceInsideDemand: t1.priceInsideDemand, priceInsideSupply: t1.priceInsideSupply,
            demandZone: t1.demandZone, supplyZone: t1.supplyZone,
            openImbalance: t1.openImbalance,
            equalHighs: t1.equalHighs, equalLows: t1.equalLows,
            liquiditySweep: t1.liquiditySweep, liquidityFlip: t1.liquidityFlip,
            stackedZones: t1.stackedZones?.filter((z: any) => z.score >= 2),
            nearestBSL: t1.nearestBSL, nearestSSL: t1.nearestSSL,
            distanceToBSLPct: t1.distanceToBSLPct != null ? +t1.distanceToBSLPct.toFixed(3) : null,
            distanceToSSLPct: t1.distanceToSSLPct != null ? +t1.distanceToSSLPct.toFixed(3) : null,
            profileShape: t1.profileShape,
            lvnLevels: t1.lvnLevels,
            tier1Pass: t1.tier1Pass,
          } : null,
          layer2Tier2Fundamental: t2 ? {
            cbDivergenceDirection: t2.cbDivergenceDirection,
            cbAlignsWithSystemSignal: t2.cbAlignsWithSystemSignal,
            timeDecayWarning: t2.timeDecayWarning,
            realYieldTrend: t2.realYieldTrend,
            liquidityRegime: t2.liquidityRegime,
            cotPercentile: t2.cotPercentile,
            cotVelocity3w: t2.cotVelocity3w,
            cotOiDivergence: t2.cotOiDivergence,
            cotLiquidationRisk: t2.cotLiquidationRisk,
            tier2Pass: t2.tier2Pass,
          } : null,
          layer2Tier3Contextual: t3 ? {
            session: t3.session,
            eoqFlowActive: t3.eoqFlowActive,
            adrExhausted: t3.adrExhausted,
            adrExhaustionPct: t3.adrExhaustionPct,
            retailLongPct: t3.retailLongPct,
            retailSignal: t3.retailSignal,
            futuresConfirmation: t3.futuresConfirmation ? {
              quality: t3.futuresConfirmation.quality,
              oiChangePct: +t3.futuresConfirmation.oiChangePct.toFixed(1),
              newLongsAdded: t3.futuresConfirmation.newLongsAdded,
              newShortsAdded: t3.futuresConfirmation.newShortsAdded,
            } : null,
          } : null,
          conflictFlags: dm?.conflictFlags ?? [],
          convictionThreshold: dm?.convictionThreshold,
        };
      })
    : pairsSummary;

  const calendarSummary = context.calendar ? {
    dangerZoneActive: context.calendar.dangerZoneActive,
    dangerZoneMessage: context.calendar.dangerZoneMessage,
    highImpactNext24h: context.calendar.highImpactNext24h?.map(e => ({
      title: e.title,
      country: e.country,
      time: e.time,
      impact: e.impact,
      forecast: e.forecast,
      previous: e.previous,
      minutesUntil: e.minutesUntil,
    })) ?? [],
  } : null;

  const userContext = {
    scoreboardSummary: scoreData?.scorecardSummary,
    dangerZoneActive: scoreData?.dangerZoneActive,
    weeklyProfile: scoreData?.weeklyProfile,
    // pairs — includes full Decision Matrix payload per pair when available
    pairs: regimePairs,
    macro: keyMacroIndicators,
    fred: fredSummary,
    topCot,
    // Retail sentiment — all pairs (use for Tier 3 crowd positioning context)
    retailSentiment: sentimentAll.map(s => ({
      pair: s.symbol,
      longPct: s.longPct,
      shortPct: s.shortPct,
      signal: s.signal,
      signalStrength: s.signalStrength,
      interpretation: s.interpretation,
    })),
    // Upcoming high-impact events — use to validate Tier 3 timing
    calendar: calendarSummary,
    // Raw news — YOU must classify each as FUNDAMENTAL or SHOCK
    newsHeadlines: news.map((n) => ({
      headline: n.headline,
      source: n.source,
      publishedAt: n.publishedAt,
      url: n.url,
      relevantCurrencies: n.relevantCurrencies,
      ...(n.articleContent ? { articleContent: n.articleContent } : {}),
    })),
  };

  return JSON.stringify(userContext, null, 2);
}
