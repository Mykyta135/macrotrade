// ---- Macro ----
export interface MacroIndicator {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  trend: "bullish" | "bearish" | "neutral";
  signal: string;
}

export interface CurrencyStrength {
  currency: string;
  etf: string;
  trend: "bullish" | "bearish" | "neutral";
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
  vvix: MacroIndicator;
  skew: MacroIndicator;
  smh: MacroIndicator;
  eem: MacroIndicator;
  silver: MacroIndicator;
  gsRatio: number;
  copperGoldRatio: number;
  currencyStrength: CurrencyStrength[];
  pairADR: PairADR[];
  riskEnvironment: "risk-on" | "risk-off" | "neutral";
  usdBias: "bullish" | "bearish" | "neutral";
  fetchedAt: string;
}

// ---- Sentiment ----
export interface PairSentiment {
  symbol: string;
  longPct: number;
  shortPct: number;
  longPositions: number;
  shortPositions: number;
  signal: "fade-shorts" | "fade-longs" | "neutral";
  signalStrength: "strong" | "moderate" | "weak";
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

// ---- COT ----
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
  oiDivergence: "bullish_exhaustion" | "bearish_exhaustion" | "none";
  specsLiquidationRisk: "high" | "moderate" | "low";
  futuresConfirmation: FuturesConfirmation;
  bias: "bullish" | "bearish" | "neutral";
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

// ---- Calendar ----
export type EventImpact = "High" | "Medium" | "Low";

export interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: EventImpact;
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

// ---- FRED ----
export interface FredSeries {
  id: string;
  name: string;
  latestValue: number;
  previousValue: number;
  change: number;
  trend: "rising" | "falling" | "flat";
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
  liquidityRegime: "expanding" | "contracting" | "neutral";
  centralBankBias: "hawkish" | "dovish" | "neutral";
  usdFundamentalBias: "bullish" | "bearish" | "neutral";
  summary: string;
  fetchedAt: string;
  source: string;
}

// ---- ML / Regime ----
export type KnnRegime = 'trending' | 'ranging' | 'volatile' | 'crisis';
export type VolatilityCluster = 'low' | 'medium' | 'high' | 'crisis';
export type VolatilityMomentum = 'expanding' | 'contracting' | 'flat';
export type GateDecision = 'HALT' | 'RESTRICT' | 'SELECTIVE' | 'NORMAL' | 'ALERT';

export interface MlResult {
  pair: string;
  knnRegime: KnnRegime;
  volatilityCluster: VolatilityCluster;
  volatilityMomentum: VolatilityMomentum;
  atrSlope5d: number;
  cotPercentile: number | null;
  knnConfidence: number;
  directionalEfficiency: number;
  atrRatio: number;
  implication: string;
}

export interface MlData {
  results: MlResult[];
}

export interface ConflictFlag {
  conflictId: string;
  description: string;
  resolution: string;
}

export interface RegimeTier1 {
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
  demandZone: { high: number; low: number; strength: string } | null;
  supplyZone: { high: number; low: number; strength: string } | null;
  openImbalance: { top: number; bottom: number; direction: string } | null;
  equalLows: number | null;
  equalHighs: number | null;
  liquiditySweep: { direction: string; level: number; recoveryCandles: number } | null;
  liquidityFlip: { level: number; direction: string; distancePct: number; isActive: boolean } | null;
  stackedZones: StackedZone[];
  nearestBSL: number | null;
  nearestSSL: number | null;
  distanceToBSLPct: number | null;
  distanceToSSLPct: number | null;
  profileShape: string | null;
  lvnLevels: Array<{ price: number; type: string }>;
  tier1Pass: boolean;
  tier1Implication: string;
}

export interface RegimeTier2 {
  cbDivergenceDirection: string | null;
  cbDivergenceDetail: string | null;
  cbAlignsWithSystemSignal: boolean;
  cbWeeksActive: number;
  timeDecayWarning: boolean;
  realYieldTrend: string;
  realYieldImplication: string;
  liquidityRegime: string;
  liquidityImplication: string;
  cotPercentile: number | null;
  cotImplication: string;
  cotVelocity3w: number | null;
  cotOiDivergence: 'bullish_exhaustion' | 'bearish_exhaustion' | 'none' | null;
  cotLiquidationRisk: 'high' | 'moderate' | 'low' | null;
  tier2Pass: boolean;
  tier2Implication: string;
}

export interface RegimeTier3 {
  session: string;
  sessionImplication: string;
  eoqDaysUntil: number | null;
  eoqFlowActive: boolean;
  retailLongPct: number | null;
  retailSignal: string | null;
  adrExhausted: boolean;
  adrExhaustionPct: number | null;
  futuresConfirmation: FuturesConfirmation | null;
  tier3Implication: string;
}

export interface RegimePayload {
  pair: string;
  systemDirection: string;
  layer1RegimeGate: {
    volatilityState: string;
    volatilityMomentum: string;
    gateDecision: GateDecision;
    gateImplication: string;
    knnConfidence: number;
    atrRatio: number;
    atrSlope5d: number;
  };
  layer2Tier1Structural: RegimeTier1;
  layer2Tier2Fundamental: RegimeTier2;
  layer2Tier3Contextual: RegimeTier3;
  conflictFlags: ConflictFlag[];
  minTier1Required: number;
  convictionThreshold: string;
}

export interface RegimeData {
  [pair: string]: RegimePayload;
}

// ---- Technical ----
export type TrendDirection = 'uptrend' | 'downtrend' | 'consolidation';

export interface TechnicalZone {
  high: number;
  low: number;
  strength: 'strong' | 'moderate';
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
  profileShape: 'b_shape' | 'p_shape' | 'normal' | 'unknown';
  lvnLevels: Array<{ price: number; type: 'support' | 'resistance' }>;
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

export interface RSIResult {
  value: number;
  divergence: 'bullish' | 'bearish' | 'none';
  divergenceStrength: 'strong' | 'moderate' | 'none';
  overbought: boolean;
  oversold: boolean;
}

export interface DonchianResult {
  upper: number;
  lower: number;
  mid: number;
  breakout: 'bullish' | 'bearish' | 'none';
  breakoutStrength: 'strong' | 'moderate' | 'none';
  channelWidthPct: number;
}

export interface BollingerResult {
  upper: number;
  mid: number;
  lower: number;
  bandwidth: number;
  percentB: number;
  squeeze: boolean;
  expansion: boolean;
  walkingUpperBand: boolean;
  walkingLowerBand: boolean;
}

export interface TimeframeAnalysis {
  trend: TrendDirection;
  lastBOS: StructureBreak | null;
  choch: StructureBreak | null;
  demandZone: TechnicalZone | null;
  supplyZone: TechnicalZone | null;
  openImbalance: Imbalance | null;
  equalHighs: number | null;
  equalLows: number | null;
  atr14: number;
  momentumBias: 'bullish' | 'bearish' | 'neutral';
  lastCandleType: string;
  volumeProfile: VolumeProfile | null;
  liquiditySweep: LiquiditySweep | null;
  liquidityFlip: LiquidityFlip | null;
  rsi: RSIResult | null;
  donchian: DonchianResult | null;
  bollinger: BollingerResult | null;
}

export interface StackedZone {
  price: number;
  score: number;
  components: string[];
  direction: 'demand' | 'supply';
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

export interface AlignmentResult {
  score: number;
  maxScore: number;
  bullish: string[];
  bearish: string[];
}

export interface TechnicalContext {
  pair: string;
  currentPrice: number;
  timeframes: {
    weekly: TimeframeAnalysis;
    daily: TimeframeAnalysis;
    h4: TimeframeAnalysis;
    h1: TimeframeAnalysis;
  };
  alignment: AlignmentResult;
  priceVsZones: {
    insideDemand: boolean;
    insideSupply: boolean;
    distanceToDemandPct: number;
    distanceToSupplyPct: number;
  };
  sessionLevels: SessionLevels | null;
  stackedZones: StackedZone[];
}

export interface TechnicalData {
  [pair: string]: TechnicalContext;
}

// ---- Score ----
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
  status: "pass" | "fail" | "warn";
  detail: string;
}

export interface PairScore {
  pair: string;
  baseCurrency: string;
  quoteCurrency: string;
  direction: "BUY" | "SELL" | "WATCH" | "NO TRADE";
  systemBias?: "BUY" | "SELL"; // underlying directional bias regardless of gate/score
  totalScore: number;
  maxScore: number; // always 5
  grade: "A" | "B" | "C" | "WATCH" | "NO TRADE";
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

// ---- Journal ----
export type TradeOutcome = "WIN" | "LOSS" | "BREAKEVEN" | "OPEN";
export type TradeDirection = "BUY" | "SELL";
export type TradeGrade = "A" | "B" | "C" | "WATCH" | "NO TRADE";

export interface TradeJournal {
  id: number;
  pair: string;
  direction: TradeDirection;
  outcome: TradeOutcome;
  entryDate: string;
  exitDate: string | null;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number | null;
  pnlPips: number | null;
  pnlPercent: number | null;
  // System snapshot
  systemGrade: TradeGrade | null;
  systemScore: number | null;
  systemMaxScore: number | null;
  systemDirection: string | null;
  systemKillSwitches: Array<{ name: string; passed: boolean }> | null;
  systemFactors: Array<{ name: string; score: number; maxScore: number; status: string }> | null;
  // Macro
  macroRiskEnv: string | null;
  macroUsdBias: string | null;
  dxyPrice: number | null;
  vixPrice: number | null;
  us10yPrice: number | null;
  // Regime
  regimeGateDecision: string | null;
  knnRegime: string | null;
  cbBias: string | null;
  liquidityRegime: string | null;
  // Technical
  alignmentScore: number | null;
  trendWeekly: string | null;
  trendDaily: string | null;
  trendH4: string | null;
  trendH1: string | null;
  // Journal
  entryRationale: string | null;
  exitNotes: string | null;
  lessonsLearned: string | null;
  followedSystem: boolean;
  overrodeSignal: boolean;
  overrideReason: string | null;
  emotionRating: number | null;
  tags: string[];
  screenshotUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalListResponse {
  trades: TradeJournal[];
  total: number;
}

export interface GradeStats {
  trades: number;
  wins: number;
  winRate: number;
}

export interface PairStats {
  trades: number;
  wins: number;
  winRate: number;
  totalPips: number;
}

export interface JournalStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winRate: number;
  avgRR: number;
  avgPnlPips: number;
  totalPnlPips: number;
  profitFactor: number;
  byGrade: Record<string, GradeStats>;
  byPair: Record<string, PairStats>;
  followedSystemWinRate: number;
  overrodeSystemWinRate: number;
  byOutcome: Record<string, number>;
  avgEmotionRating: number;
  longestWinStreak: number;
  longestLossStreak: number;
  recentPerformance: Array<{ date: string; pnlPips: number; outcome: string; rMultiple: number | null }>;
  // Prop firm metrics
  maxDrawdownPips: number;
  maxDrawdownPct: number | null;     // null if no riskPercent entered
  recoveryFactor: number | null;
  expectancyR: number;               // avg R multiple per trade
  avgWinPips: number;
  avgLossPips: number;
  avgDurationHours: number | null;
  byDay: Record<string, { trades: number; pnlPips: number; winRate: number }>; // Mon–Fri
  bySession: Record<string, { trades: number; pnlPips: number; winRate: number }>; // London/NY/Asia
  worstDayPips: number;
  worstDayDate: string | null;
  consecutiveLossesMax: number;      // same as longestLossStreak but explicit for prop
  sharpeEstimate: number | null;     // simplified: avgR / stddevR
}

export interface CreateTradePayload {
  pair: string;
  direction: TradeDirection;
  entryDate: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  systemGrade?: string;
  systemScore?: number;
  systemMaxScore?: number;
  systemDirection?: string;
  systemKillSwitches?: Array<{ name: string; passed: boolean }>;
  systemFactors?: Array<{ name: string; score: number; maxScore: number; status: string }>;
  macroRiskEnv?: string;
  macroUsdBias?: string;
  dxyPrice?: number;
  vixPrice?: number;
  us10yPrice?: number;
  regimeGateDecision?: string;
  knnRegime?: string;
  cbBias?: string;
  liquidityRegime?: string;
  alignmentScore?: number;
  trendWeekly?: string;
  trendDaily?: string;
  trendH4?: string;
  trendH1?: string;
  entryRationale?: string;
  followedSystem?: boolean;
  overrodeSignal?: boolean;
  overrideReason?: string;
  emotionRating?: number;
  tags?: string[];
}

export interface UpdateTradePayload {
  exitDate?: string;
  exitPrice?: number;
  outcome?: TradeOutcome;
  pnlPips?: number;
  pnlPercent?: number;
  exitNotes?: string;
  lessonsLearned?: string;
  followedSystem?: boolean;
  overrodeSignal?: boolean;
  overrideReason?: string;
  emotionRating?: number;
  tags?: string[];
  entryRationale?: string;
}
