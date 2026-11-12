import { TechnicalContext, TimeframeAnalysis } from '../technical/technical.interfaces';
import { MlResult, KnnRegime, VolatilityCluster, VolatilityMomentum } from './ml.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GateDecision = 'HALT' | 'RESTRICT' | 'SELECTIVE' | 'NORMAL' | 'ALERT';

export interface ConflictFlag {
  conflictId: string;
  description: string;
  resolution: string;
}

export interface Tier1Structural {
  weeklyTrend: string;
  dailyTrend: string;
  h4Trend: string;
  h1Trend: string;
  alignmentScore: number;
  alignmentMax: number;
  alignmentImplication: string;
  isBosConfirmed: boolean;
  bosDirection: string | null;
  bosLevel: number | null;
  isChochActive: boolean;
  chochWarning: string | null;
  priceInsideDemand: boolean;
  priceInsideSupply: boolean;
  demandZone: { low: number; high: number; strength: string } | null;
  supplyZone: { low: number; high: number; strength: string } | null;
  openImbalance: { direction: string; bottom: number; top: number } | null;
  equalLows: number | null;
  equalHighs: number | null;
  // Liquidity sweep: stop hunt complete, high-conviction reversal signal
  liquiditySweep: { direction: string; level: number; recoveryCandles: number } | null;
  // Liquidity flip: BOS level retested from correct side = institutional re-entry
  liquidityFlip: { level: number; direction: string; distancePct: number; isActive: boolean } | null;
  // Stacked zones: multiple signals converging at one price = A+ setup location
  stackedZones: Array<{ price: number; score: number; components: string[]; direction: string }>;
  // Session levels: BSL/SSL institutional liquidity pools
  nearestBSL: number | null;
  nearestSSL: number | null;
  distanceToBSLPct: number | null;
  distanceToSSLPct: number | null;
  // Profile shape: b = mean reversion up, P = mean reversion down
  profileShape: string | null;
  // LVN: nearest low-volume nodes (true S/R or vacuum zones)
  lvnLevels: Array<{ price: number; type: string }>;
  tier1Pass: boolean;
  tier1Implication: string;
}

export interface Tier2Fundamental {
  cbDivergenceDirection: string | null;
  cbDivergenceDetail: string | null;
  cbAlignsWithSystemSignal: boolean;
  cbWeeksActive: number;
  timeDecayWarning: boolean;
  realYieldTrend: string | null;
  realYieldImplication: string;
  liquidityRegime: string | null;
  liquidityImplication: string;
  cotPercentile: number | null;
  cotImplication: string;
  // Deep COT: velocity, OI divergence, liquidation cascade risk
  cotVelocity3w: number | null;
  cotOiDivergence: 'bullish_exhaustion' | 'bearish_exhaustion' | 'none' | null;
  cotLiquidationRisk: 'high' | 'moderate' | 'low' | null;
  tier2Pass: boolean;
  tier2Implication: string;
}

export type FuturesQuality = 'institutional' | 'covering_only' | 'liquidation_only' | 'neutral';

export interface FuturesConfirmation {
  quality: FuturesQuality;
  oiChange: number;
  oiChangePct: number;
  newLongsAdded: number;
  newShortsAdded: number;
  implication: string;
}

export interface Tier3Contextual {
  session: string | null;
  sessionImplication: string;
  eoqDaysUntil: number | null;
  eoqFlowActive: boolean;
  retailLongPct: number | null;
  retailSignal: string | null;
  adrExhausted: boolean;
  adrExhaustionPct: number | null;
  // CME futures quality: new money vs covering/liquidation (the DIX equivalent for FX)
  futuresConfirmation: FuturesConfirmation | null;
  tier3Implication: string;
}

export interface RegimePayload {
  pair: string;
  systemDirection: string;
  layer1RegimeGate: {
    volatilityState: VolatilityCluster;
    volatilityMomentum: VolatilityMomentum;
    gateDecision: GateDecision;
    gateImplication: string;
    knnConfidence: number;
    atrRatio: number;
    atrSlope5d: number;
  };
  layer2Tier1Structural: Tier1Structural;
  layer2Tier2Fundamental: Tier2Fundamental;
  layer2Tier3Contextual: Tier3Contextual;
  conflictFlags: ConflictFlag[];
  minTier1Required: number;
  convictionThreshold: string;
}

// ── Gate Decision lookup ──────────────────────────────────────────────────────

function resolveGate(state: VolatilityCluster, momentum: VolatilityMomentum): GateDecision {
  if (state === 'crisis') return 'HALT';
  if (momentum === 'expanding' && state === 'high') return 'HALT';
  if (momentum === 'expanding' && state === 'medium') return 'RESTRICT';
  if (state === 'high' && momentum === 'contracting') return 'SELECTIVE';
  if (state === 'high' && momentum === 'flat') return 'RESTRICT';
  if (state === 'low' && momentum === 'expanding') return 'ALERT';
  return 'NORMAL';
}

function gateImplication(gate: GateDecision, momentum: VolatilityMomentum): string {
  switch (gate) {
    case 'HALT':
      return 'Market structure breakdown or crisis volatility. No new entries. All signals default to WATCH regardless of grade.';
    case 'RESTRICT':
      return 'Elevated volatility expanding. Only mean reversion at confirmed structural extremes. All three tiers must agree before entry.';
    case 'SELECTIVE':
      return 'High volatility but contracting — panic subsiding. Mean reversion window open. COT extremes now valid as confirmation. Require Tier 1 + one other tier.';
    case 'ALERT':
      return 'Low volatility expanding — breakout regime beginning. Trend entry authorized on clear HTF alignment with structural void ahead. Candle close confirmation required. Watch for false breakout / liquidity grab.';
    case 'NORMAL':
      return momentum === 'contracting'
        ? 'Low-to-medium volatility, contracting. Optimal trend-following conditions. Standard signal evaluation applies.'
        : 'Normal market conditions. Standard Decision Matrix applies. Trend-following favored in low vol.';
  }
}

function convictionThreshold(gate: GateDecision): { minTier1: number; label: string } {
  switch (gate) {
    case 'HALT':     return { minTier1: 99, label: 'NO TRADE — gate closed' };
    case 'RESTRICT': return { minTier1: 3,  label: 'All tiers must pass' };
    case 'SELECTIVE':return { minTier1: 2,  label: 'Tier 1 + one other tier required' };
    case 'ALERT':    return { minTier1: 1,  label: 'Tier 1 structural alignment sufficient — but candle close required' };
    case 'NORMAL':   return { minTier1: 2,  label: 'Tier 1 + one other tier required' };
  }
}

// ── Tier 1 builder ────────────────────────────────────────────────────────────

function buildTier1(tech: TechnicalContext, systemDirection: string): Tier1Structural {
  const tfs = tech.timeframes;
  const daily = tfs?.daily as TimeframeAnalysis | null;

  const alignmentScore = tech.alignment.score;
  const bullish = tech.alignment.bullish;
  const bearish = tech.alignment.bearish;

  const isBuy = systemDirection === 'BUY';
  const alignedWithSignal = isBuy ? bullish.length >= bearish.length : bearish.length >= bullish.length;

  let alignmentImplication: string;
  if (alignmentScore >= 3) {
    alignmentImplication = `Strong ${bullish.length > bearish.length ? 'bullish' : 'bearish'} HTF alignment (${alignmentScore}/4). High structural conviction.`;
  } else if (alignmentScore === 2) {
    alignmentImplication = `Partial alignment (${alignmentScore}/4). HTF agrees, LTF corrective — pullback entry possible.`;
  } else {
    alignmentImplication = `Fragmented alignment (${alignmentScore}/4). Conflicting timeframes reduce structural confidence.`;
  }

  const bos = daily?.lastBOS ?? null;
  const choch = daily?.choch ?? null;
  const demand = daily?.demandZone ?? null;
  const supply = daily?.supplyZone ?? null;
  const imbalance = daily?.openImbalance ?? null;

  const isBosConfirmed = bos !== null && (isBuy ? bos.direction === 'bullish' : bos.direction === 'bearish');
  const bosVolumeWeak = bos !== null && bos.volumeRatio !== undefined && bos.volumeRatio < 0.8;
  const isChochActive = choch !== null && (isBuy ? choch.direction === 'bearish' : choch.direction === 'bullish');

  const locationOk = isBuy ? tech.priceVsZones.insideDemand || tech.priceVsZones.distanceToDemandPct < 1.5
                            : tech.priceVsZones.insideSupply || tech.priceVsZones.distanceToSupplyPct < 1.5;
  // BOS with weak volume is still a BOS but reduces pass confidence
  const tier1Pass = alignmentScore >= 2 && isBosConfirmed && !isChochActive && alignedWithSignal && !bosVolumeWeak;

  // New deep signals
  const sweep = daily?.liquiditySweep ?? null;
  const flip = daily?.liquidityFlip ?? null;
  const sessionLevels = tech.sessionLevels;
  const stackedZones = tech.stackedZones ?? [];
  const profileShape = daily?.volumeProfile?.profileShape ?? null;
  const lvnLevels = daily?.volumeProfile?.lvnLevels ?? [];

  // Sweep gives high-conviction reversal: upgrade tier1Pass even without full alignment
  const sweepConfirmsDirection = sweep !== null && (
    (isBuy && sweep.direction === 'bullish') ||
    (!isBuy && sweep.direction === 'bearish')
  );

  const parts: string[] = [];
  if (isBosConfirmed) {
    const volNote = bosVolumeWeak ? ` (low-volume BOS — reduced conviction)` : bos!.volumeRatio && bos!.volumeRatio > 1.5 ? ` (high-volume — strong conviction)` : '';
    parts.push(`Confirmed ${bos!.direction} BOS at ${bos!.level.toFixed(5)}${volNote}.`);
  }
  if (bosVolumeWeak) parts.push('BOS occurred on below-average volume — structure break not institutionally confirmed. Wait for retest or higher-volume follow-through.');
  if (isChochActive) parts.push(`WARNING: CHoCH active — potential trend reversal, conflicts with ${systemDirection} signal.`);

  if (sweep) parts.push(`LIQUIDITY SWEEP detected: ${sweep.direction === 'bullish' ? 'SSL swept' : 'BSL swept'} at ${sweep.level.toFixed(5)}, closed back inside in ${sweep.recoveryCandles} candles — stop hunt complete.${sweepConfirmsDirection ? ' HIGH CONVICTION reversal setup.' : ' Counter-direction — exercise caution.'}`);
  if (flip?.isActive) parts.push(`LIQUIDITY FLIP active: price retesting BOS level ${flip.level.toFixed(5)} as ${flip.direction === 'bullish' ? 'support' : 'resistance'} — institutional re-entry zone.`);

  if (stackedZones.length > 0) {
    const best = stackedZones.reduce((a, b) => b.score > a.score ? b : a);
    parts.push(`STACKED ZONE (score ${best.score}/3) at ${best.price.toFixed(5)}: ${best.components.join(' + ')} — ${best.score === 3 ? 'A+ setup location.' : 'strong confluence.'}`);
  }

  if (sessionLevels?.nearestBSL) parts.push(`BSL target above: ${sessionLevels.nearestBSL.toFixed(5)} (${sessionLevels.distanceToBSLPct?.toFixed(2)}% away) — institutional sell-side liquidity pool.`);
  if (sessionLevels?.nearestSSL) parts.push(`SSL target below: ${sessionLevels.nearestSSL.toFixed(5)} (${sessionLevels.distanceToSSLPct?.toFixed(2)}% away) — institutional buy-side stop pool.`);

  if (profileShape === 'b_shape') parts.push('b-shaped volume profile — long liquidation at lows detected. Mean reversion rally setup imminent.');
  else if (profileShape === 'p_shape') parts.push('P-shaped volume profile — short covering at highs detected. Mean reversion sell setup imminent.');

  if (lvnLevels.length > 0) {
    const res = lvnLevels.find(l => l.type === 'resistance');
    const sup = lvnLevels.find(l => l.type === 'support');
    if (res) parts.push(`LVN resistance at ${res.price.toFixed(5)} — thin air above, price may accelerate or reject violently.`);
    if (sup) parts.push(`LVN support at ${sup.price.toFixed(5)} — thin volume below, strong floor or vacuum.`);
  }

  if (tech.priceVsZones.insideDemand) parts.push(`Price inside daily demand zone${demand?.volumeRatio && demand.volumeRatio > 1.5 ? ' (high-volume zone — strong support)' : ''} — favorable entry location.`);
  if (tech.priceVsZones.insideSupply) parts.push(`Price inside daily supply zone${supply?.volumeRatio && supply.volumeRatio > 1.5 ? ' (high-volume zone — strong resistance)' : ''} — favorable short location.`);
  if (daily?.equalLows) parts.push(`Equal lows (SSL) at ${daily.equalLows.toFixed(5)} — liquidity pool below, sweep risk before continuation.`);
  if (daily?.equalHighs) parts.push(`Equal highs (BSL) at ${daily.equalHighs.toFixed(5)} — liquidity pool above, stop hunt risk.`);
  if (imbalance) parts.push(`Open ${imbalance.direction} imbalance ${imbalance.bottom.toFixed(5)}–${imbalance.top.toFixed(5)} acting as magnet.`);
  if (!locationOk && !tier1Pass) parts.push('Price not near key zone — poor entry location, wait for retest.');

  return {
    weeklyTrend: tfs?.weekly.trend ?? 'unknown',
    dailyTrend: daily?.trend ?? 'unknown',
    h4Trend: tfs?.h4.trend ?? 'unknown',
    h1Trend: tfs?.h1.trend ?? 'unknown',
    alignmentScore,
    alignmentMax: tech.alignment.maxScore,
    alignmentImplication,
    isBosConfirmed,
    bosDirection: bos?.direction ?? null,
    bosLevel: bos?.level ?? null,
    isChochActive,
    chochWarning: isChochActive ? `CHoCH ${choch!.direction} detected — prior trend may be reversing.` : null,
    priceInsideDemand: tech.priceVsZones.insideDemand,
    priceInsideSupply: tech.priceVsZones.insideSupply,
    demandZone: demand ? { low: demand.low, high: demand.high, strength: demand.strength } : null,
    supplyZone: supply ? { low: supply.low, high: supply.high, strength: supply.strength } : null,
    openImbalance: imbalance ? { direction: imbalance.direction, bottom: imbalance.bottom, top: imbalance.top } : null,
    equalLows: daily?.equalLows ?? null,
    equalHighs: daily?.equalHighs ?? null,
    liquiditySweep: sweep ? { direction: sweep.direction, level: sweep.level, recoveryCandles: sweep.recoveryCandles } : null,
    liquidityFlip: flip ?? null,
    stackedZones,
    nearestBSL: sessionLevels?.nearestBSL ?? null,
    nearestSSL: sessionLevels?.nearestSSL ?? null,
    distanceToBSLPct: sessionLevels?.distanceToBSLPct ?? null,
    distanceToSSLPct: sessionLevels?.distanceToSSLPct ?? null,
    profileShape: profileShape ?? null,
    lvnLevels,
    tier1Pass,
    tier1Implication: parts.length > 0 ? parts.join(' ') : 'No strong structural signals detected at current price.',
  };
}

// ── Tier 2 builder ────────────────────────────────────────────────────────────

interface FundamentalInputs {
  cbBias?: string;
  liquidityRegime?: string;
  realYieldTrend?: string;
  usdFundamentalBias?: string;
  cotPercentile?: number | null;
  cotVelocity3w?: number | null;
  cotOiDivergence?: 'bullish_exhaustion' | 'bearish_exhaustion' | 'none' | null;
  cotLiquidationRisk?: 'high' | 'moderate' | 'low' | null;
  systemDirection: string;
  cbWeeksActive?: number;
}

function buildTier2(inputs: FundamentalInputs): Tier2Fundamental {
  const { cbBias, liquidityRegime, realYieldTrend, cotPercentile, cotVelocity3w, cotOiDivergence, cotLiquidationRisk, systemDirection, cbWeeksActive = 0 } = inputs;
  const isBuy = systemDirection === 'BUY';

  // CB divergence alignment
  const cbAlignsWithSignal = cbBias === 'hawkish'
    ? !isBuy  // hawkish = currency strengthens = sell pair if USD is quote
    : cbBias === 'dovish' ? isBuy : true;

  const timeDecayWarning = cbWeeksActive > 3 && !cbAlignsWithSignal;

  // Real yield implication
  let realYieldImplication = 'Real yield data unavailable.';
  if (realYieldTrend === 'rising') realYieldImplication = 'Rising US real yields support USD strength — headwind for EUR/GBP/AUD longs.';
  else if (realYieldTrend === 'falling') realYieldImplication = 'Falling US real yields weaken USD — tailwind for risk currencies and gold.';

  // Liquidity implication
  let liquidityImplication = 'Liquidity data unavailable.';
  if (liquidityRegime === 'expanding') liquidityImplication = 'Expanding liquidity supports risk assets — tailwind for commodity currencies.';
  else if (liquidityRegime === 'contracting') liquidityImplication = 'Contracting liquidity — mild headwind for risk assets.';
  else if (liquidityRegime === 'neutral') liquidityImplication = 'Neutral liquidity regime — no strong directional bias.';

  // COT deep implication
  let cotImplication = 'COT data unavailable — not a factor.';
  if (cotPercentile !== null && cotPercentile !== undefined) {
    const crowdParts: string[] = [];
    if (cotPercentile > 85) crowdParts.push(`extreme bullish crowding (${cotPercentile}th pct). Fuel for reversal if spark arrives. Do not add to longs.`);
    else if (cotPercentile < 15) crowdParts.push(`extreme bearish crowding (${cotPercentile}th pct). Potential reversal setup if volatility contracts.`);
    else crowdParts.push(`${cotPercentile}th percentile — no extreme positioning.`);

    if (cotVelocity3w && Math.abs(cotVelocity3w) > 20000) {
      crowdParts.push(`3-week velocity ${cotVelocity3w > 0 ? '+' : ''}${cotVelocity3w.toLocaleString()} contracts — RAPID accumulation, exhaustion approaching.`);
    }
    if (cotOiDivergence === 'bullish_exhaustion') {
      crowdParts.push('OI divergence: OI falling while specs max long — rally is short-squeeze fuel only, not institutional buying. Trend functionally dead.');
    } else if (cotOiDivergence === 'bearish_exhaustion') {
      crowdParts.push('OI divergence: shorts crowded + OI building — short-squeeze potential if structure breaks up.');
    }
    if (cotLiquidationRisk === 'high') {
      crowdParts.push('LIQUIDATION CASCADE risk HIGH: multi-billion stop pool behind any structure break. System waits for break THEN front-runs spec liquidation.');
    }
    cotImplication = `COT: ${crowdParts.join(' ')}`;
  }

  const tier2Pass = cbAlignsWithSignal && !timeDecayWarning;

  const parts: string[] = [];
  if (cbBias) parts.push(`CB bias ${cbBias} — ${cbAlignsWithSignal ? 'aligns with' : 'conflicts with'} ${systemDirection} signal.`);
  if (timeDecayWarning) parts.push('Time-decay warning: CB divergence active 3+ weeks without price confirmation — Tier 1 overrides.');
  if (realYieldTrend) parts.push(realYieldImplication);
  if (liquidityRegime) parts.push(liquidityImplication);
  if (cotLiquidationRisk === 'high') parts.push('COT liquidation cascade risk high — downside move will be larger than normal if structure breaks.');

  return {
    cbDivergenceDirection: cbBias ?? null,
    cbDivergenceDetail: cbBias ? `${cbBias} central bank environment` : null,
    cbAlignsWithSystemSignal: cbAlignsWithSignal,
    cbWeeksActive,
    timeDecayWarning,
    realYieldTrend: realYieldTrend ?? null,
    realYieldImplication,
    liquidityRegime: liquidityRegime ?? null,
    liquidityImplication,
    cotPercentile: cotPercentile ?? null,
    cotImplication,
    cotVelocity3w: cotVelocity3w ?? null,
    cotOiDivergence: cotOiDivergence ?? null,
    cotLiquidationRisk: cotLiquidationRisk ?? null,
    tier2Pass,
    tier2Implication: parts.join(' ') || 'Fundamental data unavailable.',
  };
}

// ── Tier 3 builder ────────────────────────────────────────────────────────────

interface ContextualInputs {
  dangerZoneActive?: boolean;
  retailLongPct?: number;
  retailSignal?: string;
  adrExhausted?: boolean;
  adrExhaustionPct?: number;
  futuresConfirmation?: FuturesConfirmation | null;
}

function buildTier3(inputs: ContextualInputs): Tier3Contextual {
  const { dangerZoneActive, retailLongPct, retailSignal, adrExhausted, adrExhaustionPct, futuresConfirmation } = inputs;

  const now = new Date();
  const hour = now.getUTCHours();
  let session: string;
  let sessionImplication: string;

  if (hour >= 8 && hour < 12) { session = 'london'; sessionImplication = 'London session — high GBP/EUR liquidity. Valid directional signals.'; }
  else if (hour >= 12 && hour < 17) { session = 'london_ny_overlap'; sessionImplication = 'London/NY overlap — highest volume window. Breakouts and continuations most reliable.'; }
  else if (hour >= 17 && hour < 22) { session = 'new_york'; sessionImplication = 'NY session — USD pairs most active. Valid for USD-correlated signals.'; }
  else if (hour >= 0 && hour < 8) { session = 'asia'; sessionImplication = 'Asia session — AUD/NZD/JPY primary. Low liquidity for EUR/GBP signals.'; }
  else { session = 'dead_zone'; sessionImplication = 'Low-liquidity window. Avoid new entries — spread risk elevated.'; }

  // EOQ calculation
  const month = now.getUTCMonth() + 1;
  const eomDay = new Date(now.getUTCFullYear(), month, 0).getUTCDate();
  const daysUntilEom = eomDay - now.getUTCDate();
  const isEoqMonth = [3, 6, 9, 12].includes(month);
  const eoqFlowActive = isEoqMonth && daysUntilEom <= 5;

  let retailImplication = 'Retail sentiment data unavailable.';
  if (retailLongPct !== undefined) {
    if (retailSignal === 'fade-shorts' && retailLongPct < 40) retailImplication = `Retail majority short (${retailLongPct}% long) — contrarian BUY signal. Moderate confirmation.`;
    else if (retailSignal === 'fade-longs' && retailLongPct > 60) retailImplication = `Retail majority long (${retailLongPct}% long) — contrarian SELL signal. Moderate confirmation.`;
    else retailImplication = `Retail positioning neutral (${retailLongPct}% long) — no contrarian signal.`;
  }

  const parts: string[] = [sessionImplication];
  if (dangerZoneActive) parts.push('High-impact economic event within 24h — danger zone active. Reduce size, widen stops.');
  if (eoqFlowActive) parts.push('Quarter-end rebalancing window (last 5 days of quarter) — institutional flows may amplify or reverse current move.');
  if (adrExhausted) parts.push(`ADR exhausted (${adrExhaustionPct ?? '?'}% of daily range consumed) — momentum extension risk. Wait for next session or look for reversal only.`);
  else if (adrExhaustionPct !== undefined && adrExhaustionPct > 60) parts.push(`ADR ${adrExhaustionPct}% consumed — limited intraday fuel remaining. Prefer pullback entries over breakout chasing.`);
  if (retailLongPct !== undefined) parts.push(retailImplication);
  if (futuresConfirmation && futuresConfirmation.quality !== 'neutral') {
    parts.push(`CME FUTURES: ${futuresConfirmation.implication}`);
  }

  return {
    session,
    sessionImplication,
    eoqDaysUntil: daysUntilEom,
    eoqFlowActive,
    retailLongPct: retailLongPct ?? null,
    retailSignal: retailSignal ?? null,
    adrExhausted: adrExhausted ?? false,
    adrExhaustionPct: adrExhaustionPct ?? null,
    futuresConfirmation: futuresConfirmation ?? null,
    tier3Implication: parts.join(' '),
  };
}

// ── Conflict detector ─────────────────────────────────────────────────────────

function detectConflicts(
  tier1: Tier1Structural,
  tier2: Tier2Fundamental,
  tier3: Tier3Contextual,
  ml: MlResult,
  systemDirection: string,
): ConflictFlag[] {
  const flags: ConflictFlag[] = [];
  const isBuy = systemDirection === 'BUY';

  // Conflict B: Tier-1 trend vs COT extreme
  if (tier1.alignmentScore >= 3 && tier2.cotPercentile !== null) {
    if (isBuy && tier2.cotPercentile > 85) {
      flags.push({
        conflictId: 'B',
        description: 'Strong bullish alignment but COT specs at extreme long — crowding risk.',
        resolution: 'Rule B triggered: Maintain BUY direction. Reduce position size. Tighten target to next structural level only. Upgrade to WATCH if vol momentum starts expanding.',
      });
    } else if (!isBuy && tier2.cotPercentile < 15) {
      flags.push({
        conflictId: 'B',
        description: 'Strong bearish alignment but COT specs at extreme short — squeeze risk.',
        resolution: 'Rule B triggered: Maintain SELL direction. Reduce position size. Tighten target to next structural level only. Upgrade to WATCH if vol momentum starts expanding.',
      });
    }
  }

  // Conflict C: Gate RESTRICT/HALT vs high system grade (handled by gate, flagged here for Claude)
  if ((ml.volatilityCluster === 'high' || ml.volatilityCluster === 'crisis') && ml.volatilityMomentum === 'expanding') {
    flags.push({
      conflictId: 'C',
      description: 'Regime gate is RESTRICT/HALT — overrides system grade regardless of score.',
      resolution: 'Rule C triggered: Downgrade to WATCH. Regime gate takes absolute precedence over system A/B/C grade.',
    });
  }

  // Conflict D: Good alignment but price in wrong zone
  if (tier1.alignmentScore >= 3 && isBuy && tier1.priceInsideSupply) {
    flags.push({
      conflictId: 'D',
      description: 'HTF alignment bullish but price currently inside supply zone — poor entry location.',
      resolution: 'Rule D triggered: Apply MODIFIED. Direction confirmed, entry timing wrong. Wait for price to clear supply or pull back to demand before entry.',
    });
  } else if (tier1.alignmentScore >= 3 && !isBuy && tier1.priceInsideDemand) {
    flags.push({
      conflictId: 'D',
      description: 'HTF alignment bearish but price currently inside demand zone — poor entry location.',
      resolution: 'Rule D triggered: Apply MODIFIED. Direction confirmed, entry timing wrong. Wait for price to break demand or rally to supply before entry.',
    });
  }

  // Conflict E: CB divergence vs real yields contradicting each other
  if (tier2.cbAlignsWithSystemSignal && tier2.realYieldTrend) {
    const realYieldConflict = isBuy && tier2.realYieldTrend === 'rising';
    if (realYieldConflict) {
      flags.push({
        conflictId: 'E',
        description: 'CB divergence supports signal but rising real yields strengthen USD — fundamental contradiction.',
        resolution: 'Rule E triggered: Flag contradictory fundamental environment. Reduce conviction on USD directional trade until real yields confirm CB direction.',
      });
    }
  }

  // Conflict F: Liquidity grab — CHoCH active after breakout attempt
  if (tier1.isChochActive && ml.volatilityMomentum === 'expanding') {
    flags.push({
      conflictId: 'F',
      description: 'CHoCH active during volatility expansion — likely liquidity grab / failed breakout.',
      resolution: 'Rule F triggered: Downgrade to RESTRICT. Failed breakout is a Tier 1 signal in the opposite direction. "From failed moves come fast moves" — bias flips.',
    });
  }

  // Conflict A: Time-decay on fundamentals
  if (tier2.timeDecayWarning) {
    flags.push({
      conflictId: 'A',
      description: 'CB divergence active 3+ weeks without price confirmation — fundamentals expired.',
      resolution: 'Rule A triggered: Tier 1 structure overrides completely. Price is the final arbiter. Do not fight Tier 1 trend based on stale Tier 2 divergence.',
    });
  }

  // Conflict G: COT liquidation cascade — spec crowding + OI divergence + structure break = amplified move
  if (tier2.cotLiquidationRisk === 'high') {
    flags.push({
      conflictId: 'G',
      description: 'COT liquidation cascade setup: specs crowded + OI diverging + rapid accumulation. Multi-billion stop pool behind structural break.',
      resolution: 'Rule G triggered: Do NOT trade against the structure break direction. If BOS breaks with the crowd, the cascade amplifies the move — ride it. If BOS breaks against the crowd, that IS the cascade — the most violent reversal setup in the system.',
    });
  }

  // Conflict H: Liquidity sweep confirmed — high conviction reversal
  if (tier1.liquiditySweep) {
    const sweepAligns = (isBuy && tier1.liquiditySweep.direction === 'bullish') ||
                        (!isBuy && tier1.liquiditySweep.direction === 'bearish');
    if (sweepAligns) {
      flags.push({
        conflictId: 'H',
        description: `Liquidity sweep detected: ${tier1.liquiditySweep.direction === 'bullish' ? 'SSL swept' : 'BSL swept'} at ${tier1.liquiditySweep.level.toFixed(5)} — stop hunt complete, institutional reversal likely.`,
        resolution: 'Rule H triggered: Sweep CONFIRMS the trade direction. Stops were hunted, liquidity collected. This is the entry trigger. High conviction — upgrade aiConfidenceAdjustment by +1.',
      });
    } else {
      flags.push({
        conflictId: 'H',
        description: `Counter-direction liquidity sweep: ${tier1.liquiditySweep.direction} sweep conflicts with ${systemDirection} signal.`,
        resolution: 'Rule H triggered: Sweep is working AGAINST the system signal. Institutional sweep may be setting up a move opposite to the system direction. Downgrade to WATCH, wait for structure to clarify.',
      });
    }
  }

  // Conflict I: Stacked zone — A+ setup location
  if (tier1.stackedZones.length > 0) {
    const best = tier1.stackedZones.reduce((a, b) => b.score > a.score ? b : a);
    if (best.score === 3) {
      flags.push({
        conflictId: 'I',
        description: `A+ stacked zone at ${best.price.toFixed(5)}: ${best.components.join(' + ')} all converging. Triple confluence.`,
        resolution: 'Rule I triggered: Triple-stacked zone is the highest precision entry location in the system. If gate allows and tiers pass, this is maximum conviction. Upgrade aiConfidenceAdjustment by +1 if price is at or within 0.3% of the stacked zone.',
      });
    }
  }

  // Conflict K: CME futures quality — move not backed by new institutional money
  if (tier3.futuresConfirmation && tier3.futuresConfirmation.quality !== 'neutral' && tier3.futuresConfirmation.quality !== 'institutional') {
    const isCovering = tier3.futuresConfirmation.quality === 'covering_only';
    const isLiquidation = tier3.futuresConfirmation.quality === 'liquidation_only';
    if ((isBuy && isCovering) || (!isBuy && isLiquidation)) {
      flags.push({
        conflictId: 'K',
        description: `CME futures quality LOW: ${isCovering ? 'bullish move driven by short-covering only — no new longs entering' : 'bearish move driven by long liquidation only — no new shorts building'}. OI ${tier3.futuresConfirmation.oiChangePct.toFixed(1)}% this week.`,
        resolution: `Rule K triggered: Signal direction is ${isCovering ? 'real but has no new institutional fuel' : 'structurally weak — longs exiting, not bears attacking'}. MODIFIED — reduce position size by 50%. Treat as a scalp/mean-reversion only. Do not hold for multi-day swing. The move exhausts when covering/liquidation completes.`,
      });
    }
  }

  // Conflict J: OI divergence — trend functionally dead
  if (tier2.cotOiDivergence === 'bullish_exhaustion' && isBuy) {
    flags.push({
      conflictId: 'J',
      description: 'OI divergence: bullish price + falling OI + max-long specs = short-squeeze rally, not institutional buying. Trend functionally exhausted.',
      resolution: 'Rule J triggered: Do NOT add to longs. The rally has no institutional fuel — only forced short covering. If BOS fails or CHoCH appears, cascade down is imminent. Reduce position size to minimum, tighten stop.',
    });
  } else if (tier2.cotOiDivergence === 'bearish_exhaustion' && !isBuy) {
    flags.push({
      conflictId: 'J',
      description: 'OI divergence: OI building with max-short specs = short-squeeze potential building. Counter-trend risk elevated.',
      resolution: 'Rule J triggered: Short squeeze fuel is building. Maintain SELL only if Tier 1 structure is strongly confirmed. Add stop above nearest BSL to protect against squeeze.',
    });
  }

  return flags;
}

// ── Main assembler ────────────────────────────────────────────────────────────

export interface RegimeMapperInputs {
  ml: MlResult;
  tech: TechnicalContext;
  systemDirection: string;
  cbBias?: string;
  liquidityRegime?: string;
  realYieldTrend?: string;
  cotPercentile?: number | null;
  cotVelocity3w?: number | null;
  cotOiDivergence?: 'bullish_exhaustion' | 'bearish_exhaustion' | 'none' | null;
  cotLiquidationRisk?: 'high' | 'moderate' | 'low' | null;
  futuresConfirmation?: FuturesConfirmation | null;
  dangerZoneActive?: boolean;
  retailLongPct?: number;
  retailSignal?: string;
  adrExhausted?: boolean;
  adrExhaustionPct?: number;
}

export function buildRegimePayload(inputs: RegimeMapperInputs): RegimePayload {
  const { ml, tech, systemDirection, cbBias, liquidityRegime, realYieldTrend, cotPercentile, cotVelocity3w, cotOiDivergence, cotLiquidationRisk, futuresConfirmation, dangerZoneActive, retailLongPct, retailSignal, adrExhausted, adrExhaustionPct } = inputs;

  const gate = resolveGate(ml.volatilityCluster, ml.volatilityMomentum);
  const { minTier1, label: convictionLabel } = convictionThreshold(gate);

  const tier1 = buildTier1(tech, systemDirection);
  const tier2 = buildTier2({ cbBias, liquidityRegime, realYieldTrend, cotPercentile, cotVelocity3w, cotOiDivergence, cotLiquidationRisk, systemDirection });
  const tier3 = buildTier3({ dangerZoneActive, retailLongPct, retailSignal, adrExhausted, adrExhaustionPct, futuresConfirmation });
  const conflicts = detectConflicts(tier1, tier2, tier3, ml, systemDirection);

  return {
    pair: ml.pair,
    systemDirection,
    layer1RegimeGate: {
      volatilityState: ml.volatilityCluster,
      volatilityMomentum: ml.volatilityMomentum,
      gateDecision: gate,
      gateImplication: gateImplication(gate, ml.volatilityMomentum),
      knnConfidence: ml.knnConfidence,
      atrRatio: ml.atrRatio,
      atrSlope5d: ml.atrSlope5d,
    },
    layer2Tier1Structural: tier1,
    layer2Tier2Fundamental: tier2,
    layer2Tier3Contextual: tier3,
    conflictFlags: conflicts,
    minTier1Required: minTier1,
    convictionThreshold: convictionLabel,
  };
}
