// ============================================================
// Backend Context Types (from :3001)
// ============================================================

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
  us2y: number;
  us10y: number;
  spread: number;
  inverted: boolean;
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
  liquidityRegime: 'expanding' | 'contracting' | 'neutral';
  centralBankBias: 'hawkish' | 'dovish' | 'neutral';
  usdFundamentalBias: 'bullish' | 'bearish' | 'neutral';
  summary: string;
  fetchedAt: string;
  source: string;
}

export interface MacroIndicator {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  signal: string;
}

export interface CurrencyStrength {
  currency: string;
  etf: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  price: number;
}

export interface PairADR {
  pair: string;
  adr14Pips: number;
  todayRangePips: number;
  exhaustionPct: number;
  exhausted: boolean;
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
  vvix?: MacroIndicator;
  skew?: MacroIndicator;
  smh?: MacroIndicator;
  eem?: MacroIndicator;
  silver?: MacroIndicator;
  gsRatio?: number;
  copperGoldRatio?: number;
  currencyStrength: CurrencyStrength[];
  pairADR: PairADR[];
  riskEnvironment: 'risk-on' | 'risk-off' | 'neutral';
  usdBias: 'bullish' | 'bearish' | 'neutral';
  fetchedAt: string;
}

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

export type FuturesQuality = 'institutional' | 'covering_only' | 'liquidation_only' | 'neutral';

export interface FuturesConfirmation {
  quality: FuturesQuality;
  oiChange: number;
  oiChangePct: number;
  newLongsAdded: number;
  newShortsAdded: number;
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
  velocity3w: number;
  oiDivergence: 'bullish_exhaustion' | 'bearish_exhaustion' | 'none';
  specsLiquidationRisk: 'high' | 'moderate' | 'low';
  futuresConfirmation: FuturesConfirmation;
  bias: 'bullish' | 'bearish' | 'neutral';
  signal: string;
  reportDate: string;
  netHistory: number[];
}

export interface CotData {
  positions: CotPosition[];
  fetchedAt: string;
  source: string;
  note: string;
}

export interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: 'High' | 'Medium' | 'Low';
  forecast: string;
  previous: string;
  isUpcoming: boolean;
  minutesUntil: number | null;
  warning: string | null;
}

export interface CalendarData {
  events: CalendarEvent[];
  highImpactNext24h: CalendarEvent[];
  dangerZoneActive: boolean;
  dangerZoneMessage: string | null;
  fetchedAt: string;
}

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
  maxScore: number;
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

// ============================================================
// Technical Analysis Types (from :3001/technical)
// ============================================================

export type TrendDirection = 'uptrend' | 'downtrend' | 'consolidation';
export type Strength = 'strong' | 'moderate';
export type CandleType = 'strong_bullish' | 'weak_bullish' | 'doji' | 'weak_bearish' | 'strong_bearish';
export type MomentumBias = 'bullish' | 'bearish' | 'neutral';

export interface Zone {
  high: number;
  low: number;
  strength: Strength;
  formedAt: number;
}

export interface StructureBreak {
  direction: 'bullish' | 'bearish';
  level: number;
  timestamp: number;
}

export interface Imbalance {
  top: number;
  bottom: number;
  direction: 'bullish' | 'bearish';
  timestamp: number;
}

export interface VolumeProfile {
  relativeVolume: number;
  volumeSpike: boolean;
  trend: 'rising' | 'falling' | 'flat';
  profileShape?: 'b_shape' | 'p_shape' | 'normal' | 'unknown';
  lvnLevels?: Array<{ price: number; type: 'support' | 'resistance' }>;
}

export interface LiquiditySweep {
  direction: 'bullish' | 'bearish';
  level: number;
  recoveryCandles: number;
}

export interface LiquidityFlip {
  level: number;
  direction: 'bullish' | 'bearish';
  distancePct: number;
  isActive: boolean;
}

export interface StackedZone {
  price: number;
  score: number;
  components: string[];
  direction: 'demand' | 'supply';
}

export interface TimeframeAnalysis {
  trend: TrendDirection;
  lastBOS: (StructureBreak & { volumeRatio?: number }) | null;
  choch: StructureBreak | null;
  demandZone: (Zone & { volumeRatio?: number }) | null;
  supplyZone: (Zone & { volumeRatio?: number }) | null;
  openImbalance: Imbalance | null;
  equalHighs: number | null;
  equalLows: number | null;
  atr14: number;
  momentumBias: MomentumBias;
  lastCandleType: CandleType;
  volumeProfile: VolumeProfile | null;
  liquiditySweep: LiquiditySweep | null;
  liquidityFlip: LiquidityFlip | null;
}

export interface SessionLevels {
  asiaHigh: number | null;
  asiaLow: number | null;
  londonHigh: number | null;
  londonLow: number | null;
  prevDayHigh: number | null;
  prevDayLow: number | null;
  nearestBSL: number | null;
  nearestSSL: number | null;
  distanceToBSLPct: number | null;
  distanceToSSLPct: number | null;
}

export interface TechnicalContext {
  pair: string;
  fetchedAt: string;
  timeframes: {
    weekly: TimeframeAnalysis;
    daily: TimeframeAnalysis;
    h4: TimeframeAnalysis;
    h1: TimeframeAnalysis;
  } | null;
  alignment: { score: number; maxScore: number; bullish: string[]; bearish: string[] };
  currentPrice: number;
  priceVsZones: {
    insideDemand: boolean;
    insideSupply: boolean;
    distanceToDemandPct: number;
    distanceToSupplyPct: number;
  };
  sessionLevels: SessionLevels | null;
  stackedZones: StackedZone[];
  dataUnavailable?: boolean;
  error?: string;
}

export interface TechnicalReport {
  generatedAt: string;
  pairs: TechnicalContext[];
}

export interface MlRegimeResult {
  pair: string;
  knnRegime: 'trending' | 'ranging' | 'volatile' | 'crisis';
  volatilityCluster: 'low' | 'medium' | 'high' | 'crisis';
  volatilityMomentum: 'expanding' | 'contracting' | 'flat';
  atrSlope5d: number;
  cotPercentile: number | null;
  knnConfidence: number;
  directionalEfficiency: number;
  atrRatio: number;
  implication: string;
}

// Regime payload — pre-assembled Decision Matrix per pair
export interface RegimePayload {
  layer1RegimeGate: {
    volatilityState: string;
    volatilityMomentum: string;
    gateDecision: string;
    gateImplication: string;
    knnConfidence: number;
    atrRatio: number;
    atrSlope5d: number;
  };
  layer2Tier1Structural: {
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
    liquiditySweep: { direction: string; level: number; recoveryCandles: number } | null;
    liquidityFlip: { level: number; direction: string; distancePct: number; isActive: boolean } | null;
    stackedZones: Array<{ price: number; score: number; components: string[]; direction: string }>;
    nearestBSL: number | null;
    nearestSSL: number | null;
    distanceToBSLPct: number | null;
    distanceToSSLPct: number | null;
    profileShape: string | null;
    lvnLevels: Array<{ price: number; type: string }>;
    tier1Pass: boolean;
    tier1Implication: string;
  };
  layer2Tier2Fundamental: {
    cbDivergenceDirection: string | null;
    cbAlignsWithSystemSignal: boolean;
    cbWeeksActive: number;
    timeDecayWarning: boolean;
    realYieldTrend: string | null;
    realYieldImplication: string;
    liquidityRegime: string | null;
    liquidityImplication: string;
    cotPercentile: number | null;
    cotImplication: string;
    cotVelocity3w: number | null;
    cotOiDivergence: 'bullish_exhaustion' | 'bearish_exhaustion' | 'none' | null;
    cotLiquidationRisk: 'high' | 'moderate' | 'low' | null;
    tier2Pass: boolean;
    tier2Implication: string;
  };
  layer2Tier3Contextual: {
    session: string | null;
    sessionImplication: string;
    eoqDaysUntil: number | null;
    eoqFlowActive: boolean;
    retailLongPct: number | null;
    retailSignal: string | null;
    adrExhausted: boolean;
    adrExhaustionPct: number | null;
    futuresConfirmation: FuturesConfirmation | null;
    tier3Implication: string;
  };
  conflictFlags: Array<{
    conflictId: string;
    description: string;
    resolution: string;
  }>;
  minTier1Required: number;
  convictionThreshold: string;
}

export interface BackendContext {
  score: ScoreData | null;
  macro: MacroData | null;
  fred: FredData | null;
  sentiment: SentimentData | null;
  cot: CotData | null;
  calendar: CalendarData | null;
  technical: TechnicalReport | null;
  ml: MlRegimeResult[] | null;
  regimePayloads: Record<string, RegimePayload> | null;
}

// ============================================================
// News & Reporter Types
// ============================================================

export interface NewsItem {
  headline: string;
  source: string;
  publishedAt: string;
  url: string;
  relevantCurrencies: string[];
  articleContent?: string;
}

export interface PairAnalysis {
  pair: string;
  systemDirection: 'BUY' | 'SELL' | 'WATCH' | 'NO TRADE';
  systemGrade: string;
  systemScore: string;
  aiVerdict: 'CONFIRMED' | 'REJECTED' | 'MODIFIED' | 'WATCH' | 'SKIP';
  aiConfidenceAdjustment: number;
  aiRationale: string;
  newsRelevance: string;
  playbookRulesApplied: string[];
}

export interface ReporterReport {
  generatedAt: string;
  reportId: string;
  environment: {
    riskEnvironment: string;
    usdBias: string;
    liquidityRegime: string;
    centralBankBias: string;
    dangerZoneActive: boolean;
  };
  executiveSummary: string;
  marketBias: 'RISK-ON' | 'RISK-OFF' | 'NEUTRAL';
  pairs: PairAnalysis[];
  topOpportunity: PairAnalysis | null;
  topWatch: PairAnalysis | null;
  newsHeadlines: NewsItem[];
  playbookFilesLoaded: string[];
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
}
