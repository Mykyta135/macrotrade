export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type TrendDirection = 'uptrend' | 'downtrend' | 'consolidation';
export type Strength = 'strong' | 'moderate';
export type CandleType = 'strong_bullish' | 'weak_bullish' | 'doji' | 'weak_bearish' | 'strong_bearish';
export type MomentumBias = 'bullish' | 'bearish' | 'neutral';

export interface Zone {
  high: number;
  low: number;
  strength: Strength;
  formedAt: number;
  volumeRatio?: number; // volume at zone formation vs 20-bar average
}

export interface StructureBreak {
  direction: 'bullish' | 'bearish';
  level: number;
  timestamp: number;
  volumeRatio?: number; // volume at BOS candle vs 20-bar average
}

export interface Imbalance {
  top: number;
  bottom: number;
  direction: 'bullish' | 'bearish';
  timestamp: number;
}

export interface VolumeProfile {
  relativeVolume: number;    // current bar volume / 20-bar average
  volumeSpike: boolean;      // relativeVolume > 2.0
  trend: 'rising' | 'falling' | 'flat'; // 5-bar vs 20-bar average
  // Profile shape proxy: b = long liquidation (mean reversion up), P = short covering (mean reversion down)
  profileShape: 'b_shape' | 'p_shape' | 'normal' | 'unknown';
  // LVN: price areas with below-average volume (strong S/R or vacuum)
  lvnLevels: Array<{ price: number; type: 'support' | 'resistance' }>;
}

export interface SessionLevels {
  // Previous session high/low = BSL (above) / SSL (below) — institutional liquidity targets
  asiaHigh: number | null;
  asiaLow: number | null;
  londonHigh: number | null;
  londonLow: number | null;
  prevDayHigh: number | null;
  prevDayLow: number | null;
  // Nearest BSL/SSL to current price
  nearestBSL: number | null; // nearest liquidity above price
  nearestSSL: number | null; // nearest liquidity below price
  distanceToBSLPct: number | null;
  distanceToSSLPct: number | null;
}

export interface LiquiditySweep {
  direction: 'bullish' | 'bearish'; // bullish = swept lows (SSL) and closed back above
  level: number;                     // equal high/low that was swept
  timestamp: number;
  recoveryCandles: number;           // candles to recover back inside
}

export interface LiquidityFlip {
  // A BOS level being retested from the correct side = institutional re-entry point
  level: number;
  direction: 'bullish' | 'bearish'; // bullish = prior resistance now acting as support
  distancePct: number;               // how close current price is to the flip level
  isActive: boolean;                 // price within 0.3% of the flip level
}

export interface StackedZone {
  // Confluence: demand/supply zone + BOS level + imbalance all near same price
  price: number;
  score: number;           // 1-3: how many signals stack (3 = A+ setup location)
  components: string[];    // which signals are stacked
  direction: 'demand' | 'supply';
}

export type DivergenceType = 'bullish' | 'bearish' | 'none';

export interface RSIResult {
  value: number;                  // 0–100, current RSI
  divergence: DivergenceType;     // price vs RSI momentum disagreement
  divergenceStrength: 'strong' | 'moderate' | 'none';
  overbought: boolean;            // RSI > 70
  oversold: boolean;              // RSI < 30
}

export interface DonchianResult {
  upper: number;                  // 20-period highest high
  lower: number;                  // 20-period lowest low
  mid: number;                    // midline
  breakout: 'bullish' | 'bearish' | 'none'; // price closing outside channel
  breakoutStrength: 'strong' | 'moderate' | 'none'; // strong = new 20p extreme
  channelWidthPct: number;        // (upper-lower)/mid*100 — volatility proxy
}

export interface BollingerResult {
  upper: number;
  mid: number;                    // 20-SMA
  lower: number;
  bandwidth: number;              // (upper-lower)/mid*100
  percentB: number;               // 0–1: where price sits in the bands
  squeeze: boolean;               // bandwidth < 20th-percentile of last 50 bars
  expansion: boolean;             // bandwidth > 80th-percentile of last 50 bars
  walkingUpperBand: boolean;      // price closing above upper for 3+ consecutive bars
  walkingLowerBand: boolean;      // price closing below lower for 3+ consecutive bars
}

export interface TimeframeAnalysis {
  trend: TrendDirection;
  lastBOS: StructureBreak | null;
  choch: StructureBreak | null;
  demandZone: Zone | null;
  supplyZone: Zone | null;
  openImbalance: Imbalance | null;
  equalHighs: number | null;
  equalLows: number | null;
  atr14: number;
  momentumBias: MomentumBias;
  lastCandleType: CandleType;
  volumeProfile: VolumeProfile | null;
  liquiditySweep: LiquiditySweep | null;
  liquidityFlip: LiquidityFlip | null;
  rsi: RSIResult | null;
  donchian: DonchianResult | null;
  bollinger: BollingerResult | null;
}

export interface AlignmentResult {
  score: number;
  maxScore: number;
  bullish: string[];
  bearish: string[];
}

export interface PriceVsZones {
  insideDemand: boolean;
  insideSupply: boolean;
  distanceToDemandPct: number;
  distanceToSupplyPct: number;
}

export interface TechnicalContext {
  pair: string;
  fetchedAt: string;
  timeframes: {
    weekly: TimeframeAnalysis;
    daily: TimeframeAnalysis;
    h4: TimeframeAnalysis;
    h1: TimeframeAnalysis;
  };
  alignment: AlignmentResult;
  currentPrice: number;
  priceVsZones: PriceVsZones;
  sessionLevels: SessionLevels | null;
  stackedZones: StackedZone[];
  dataUnavailable?: boolean;
  error?: string;
}

export interface TechnicalReport {
  generatedAt: string;
  pairs: TechnicalContext[];
}
