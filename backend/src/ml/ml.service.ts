import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { OhlcvCandle } from '../database/entities/ohlcv-candle.entity';
import { MlRegimeLabel } from '../database/entities/ml-regime-label.entity';
import { DataHealthService } from '../common/data-health.service';

export type KnnRegime = 'trending' | 'ranging' | 'volatile' | 'crisis';
export type VolatilityCluster = 'low' | 'medium' | 'high' | 'crisis';
export type VolatilityMomentum = 'expanding' | 'contracting' | 'flat';

interface FeatureVector {
  atrRatio: number;
  directionalEfficiency: number;
  bodyRatio: number;
}

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

@Injectable()
export class MlService {
  private readonly logger = new Logger(MlService.name);

  constructor(
    @InjectRepository(OhlcvCandle)
    private readonly ohlcvRepo: Repository<OhlcvCandle>,
    @InjectRepository(MlRegimeLabel)
    private readonly regimeRepo: Repository<MlRegimeLabel>,
    private readonly health: DataHealthService,
  ) {}

  // ── Feature extraction ────────────────────────────────────────────────────

  private computeATR(candles: OhlcvCandle[], period = 14): number {
    if (candles.length < period + 1) return 0;
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1].close;
      trs.push(Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - prev),
        Math.abs(candles[i].low - prev),
      ));
    }
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  private computeDirectionalEfficiency(candles: OhlcvCandle[], lookback = 20): number {
    if (candles.length < lookback) return 0;
    const recent = candles.slice(-lookback);
    const netMove = Math.abs(recent[recent.length - 1].close - recent[0].close);
    const totalPath = recent.reduce((sum, c, i) => {
      if (i === 0) return sum;
      return sum + Math.abs(c.close - recent[i - 1].close);
    }, 0);
    return totalPath === 0 ? 0 : netMove / totalPath;
  }

  private computeBodyRatio(candles: OhlcvCandle[], lookback = 20): number {
    if (candles.length < lookback) return 0;
    const recent = candles.slice(-lookback);
    const ratios = recent.map(c => {
      const range = c.high - c.low;
      return range === 0 ? 0 : Math.abs(c.close - c.open) / range;
    });
    return ratios.reduce((a, b) => a + b, 0) / ratios.length;
  }

  private extractFeatures(candles: OhlcvCandle[]): FeatureVector {
    const currentATR = this.computeATR(candles, 14);
    const avgATR = this.computeATR(candles.slice(0, -14), 20) || currentATR;
    return {
      atrRatio: avgATR === 0 ? 1 : currentATR / avgATR,
      directionalEfficiency: this.computeDirectionalEfficiency(candles),
      bodyRatio: this.computeBodyRatio(candles),
    };
  }

  // Rule-based fallback when model not loaded
  private ruleBasedRegime(f: FeatureVector): KnnRegime {
    if (f.atrRatio > 2.0) return 'crisis';
    if (f.atrRatio > 1.5) return 'volatile';
    if (f.directionalEfficiency > 0.55) return 'trending';
    return 'ranging';
  }

  // ── Класифікатор режиму: пороги, відкалібровані на історії ───────────────
  //
  // ЧОМУ НЕ KNN (перевірено експериментами 2026-07-20, див. data/pipeline/):
  //
  //   1. Стара KNN-модель заявляла 94.7% точності, але це був ВИТІК МІТКИ:
  //      мітка ставиться за порогом f_atrPct (label.js), і той самий f_atrPct
  //      подавався на вхід із найбільшою вагою. Без нього точність = 74.7%.
  //
  //   2. Задача була описова, а не прогнозна: класифікувати сьогоднішній
  //      режим за сьогоднішніми ознаками — тавтологія.
  //
  //   3. У чесній прогнозній постановці (T → T+1) KNN дав 76.6%, а тривіальне
  //      "завтра = сьогодні" (persistence) — 93.2%. Волатильність кластеризується
  //      (Mandelbrot 1963; Engle, Нобелівська премія 2003), тому persistence
  //      майже непереможний, а KNN програвав йому 16.6 п.п.
  //
  //   4. Прогноз ЗМІНИ режиму: стрибок у HIGH_VOL спійманий 0 разів із 25.
  //      Денні OHLC-свічки не містять сигналу про майбутні переходи.
  //
  // Висновок: пороги по ATR% дають ту саму інформацію дешевше й чесніше.
  // Пороги — перцентилі 13 544 днів історії 8 пар (2019–2026), калібрування
  // повторюване через data/pipeline/labeled.json.
  private static readonly ATR_PCT_LOW = 0.00662;    // p33
  private static readonly ATR_PCT_HIGH = 0.01021;   // p80
  private static readonly ATR_PCT_CRISIS = 0.01387; // p95

  /**
   * Визначає режим за рівнем волатильності (ATR% від ціни) і, для
   * середнього діапазону, за спрямованою ефективністю.
   *
   * Впевненість — НЕ ймовірність із моделі, а відстань до межі класу:
   * значення далеко від порогу → впевненість висока, близько до межі → низька.
   * Це чесна метрика: вона говорить "наскільки однозначна класифікація",
   * і не вдає прогнозної сили, якої немає.
   */
  private classifyRegime(
    candles: OhlcvCandle[],
    f: FeatureVector,
  ): { regime: KnnRegime; confidence: number } {
    const atrPct = this.computeAtrPct(candles);

    if (atrPct === null) {
      // Замало свічок — падаємо на відносні правила
      return { regime: this.ruleBasedRegime(f), confidence: 0.34 };
    }

    const { ATR_PCT_LOW, ATR_PCT_HIGH, ATR_PCT_CRISIS } = MlService;

    let regime: KnnRegime;
    let boundary: number;

    if (atrPct >= ATR_PCT_CRISIS) {
      regime = 'crisis';
      boundary = ATR_PCT_CRISIS;
    } else if (atrPct >= ATR_PCT_HIGH) {
      regime = 'volatile';
      boundary = Math.min(atrPct - ATR_PCT_HIGH, ATR_PCT_CRISIS - atrPct) + atrPct;
    } else if (atrPct <= ATR_PCT_LOW) {
      regime = 'ranging';
      boundary = ATR_PCT_LOW;
    } else {
      // Середня волатильність: тренд чи діапазон вирішує спрямована ефективність
      regime = f.directionalEfficiency > 0.5 ? 'trending' : 'ranging';
      boundary = Math.abs(atrPct - ATR_PCT_LOW) < Math.abs(atrPct - ATR_PCT_HIGH)
        ? ATR_PCT_LOW : ATR_PCT_HIGH;
    }

    // Впевненість = відносна відстань до найближчої межі, обмежена [0.35, 0.95].
    // Нижня межа 0.35 чесно каже: біля порогу класифікація майже довільна.
    const relDist = Math.abs(atrPct - boundary) / Math.max(boundary, 1e-9);
    const confidence = Math.min(0.95, Math.max(0.35, 0.5 + relDist));

    return { regime, confidence: Number(confidence.toFixed(2)) };
  }

  /** ATR14 у відсотках від ціни закриття — та сама величина, що й у калібруванні. */
  private computeAtrPct(candles: OhlcvCandle[]): number | null {
    if (candles.length < 15) return null;
    const atr = this.computeATR(candles, 14);
    const close = Number(candles[candles.length - 1].close);
    if (!Number.isFinite(atr) || !Number.isFinite(close) || close === 0) return null;
    return atr / close;
  }

  /**
   * 1-вимірний k-means на історії ATR: ділить її на 4 кластери волатильності.
   *
   * Це НЕ прогноз — суто описова кластеризація поточного рівня відносно
   * власної історії пари. На відміну від видаленого KNN, тут немає ані витоку
   * мітки, ані претензії на передбачення: кластери формуються з тих самих
   * даних, які й класифікуються, і використовуються лише як шкала "низько /
   * середньо / високо / криза" для цієї конкретної пари.
   *
   * Центроїди ініціалізуються квантилями (а не випадково) — це робить
   * результат детермінованим і відтворюваним між запусками.
   */
  private kMeansVolatility(
    atrHistory: number[],
  ): { clusters: number[]; labels: VolatilityCluster[] } {
    const sorted = [...atrHistory].filter(Number.isFinite).sort((a, b) => a - b);
    const labels: VolatilityCluster[] = ['low', 'medium', 'high', 'crisis'];

    if (sorted.length < 4) {
      return { clusters: sorted.length ? sorted.slice(0, 4) : [0, 0, 0, 0], labels };
    }

    // Детермінована ініціалізація: квантилі 12.5% / 37.5% / 62.5% / 87.5%
    const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    let centroids = [q(0.125), q(0.375), q(0.625), q(0.875)];

    for (let iter = 0; iter < 25; iter++) {
      const groups: number[][] = [[], [], [], []];
      for (const v of sorted) {
        const dists = centroids.map(c => Math.abs(v - c));
        groups[dists.indexOf(Math.min(...dists))].push(v);
      }

      const next = centroids.map((c, i) =>
        groups[i].length ? groups[i].reduce((a, b) => a + b, 0) / groups[i].length : c,
      );

      const shift = next.reduce((s, v, i) => s + Math.abs(v - centroids[i]), 0);
      centroids = next;
      if (shift < 1e-12) break;   // збіглось
    }

    // Центроїди мають лишатися впорядкованими, щоб мітки відповідали рівням
    centroids.sort((a, b) => a - b);
    return { clusters: centroids, labels };
  }

  private classifyVolatilityCluster(currentATR: number, atrHistory: number[]): VolatilityCluster {
    if (atrHistory.length < 20) {
      // Rule-based fallback
      const avg = atrHistory.reduce((a, b) => a + b, 0) / (atrHistory.length || 1);
      const ratio = avg === 0 ? 1 : currentATR / avg;
      if (ratio > 2.0) return 'crisis';
      if (ratio > 1.5) return 'high';
      if (ratio > 0.75) return 'medium';
      return 'low';
    }

    const { clusters, labels } = this.kMeansVolatility(atrHistory);
    const dists = clusters.map(c => Math.abs(currentATR - c));
    const nearest = dists.indexOf(Math.min(...dists));
    return labels[nearest] as VolatilityCluster;
  }

  // ── 3. COT Percentile ────────────────────────────────────────────────────

  private computePercentile(values: number[], current: number): number {
    if (values.length === 0) return 50;
    const below = values.filter(v => v < current).length;
    return Math.round((below / values.length) * 100);
  }

  // ── Implication text for Claude ────────────────────────────────────────

  private buildImplication(
    regime: KnnRegime,
    cluster: VolatilityCluster,
    cotPct: number | null,
  ): string {
    const parts: string[] = [];

    if (regime === 'trending') parts.push('Trending regime — favor continuation signals, avoid counter-trend entries.');
    else if (regime === 'ranging') parts.push('Ranging regime — fade extremes, reduce trend-following confidence.');
    else if (regime === 'volatile') parts.push('Volatile regime — widen stops, reduce position size, prefer WATCH verdicts.');
    else parts.push('Crisis regime — market structure unreliable, default all signals to WATCH.');

    if (cluster === 'high') parts.push('Volatility elevated — ATR-based stops will be wide.');
    else if (cluster === 'crisis') parts.push('Volatility extreme — abnormal market conditions.');

    if (cotPct !== null) {
      if (cotPct > 85) parts.push(`COT at ${cotPct}th percentile — extreme bullish crowding, fade risk.`);
      else if (cotPct < 15) parts.push(`COT at ${cotPct}th percentile — extreme bearish crowding, potential reversal.`);
    }

    return parts.join(' ');
  }

  // ── Volatility Momentum (5-day ATR slope) ────────────────────────────────

  private computeVolatilityMomentum(candles: OhlcvCandle[]): { momentum: VolatilityMomentum; slope: number } {
    if (candles.length < 20) return { momentum: 'flat', slope: 0 };
    const atrs: number[] = [];
    for (let i = candles.length - 6; i < candles.length; i++) {
      atrs.push(this.computeATR(candles.slice(0, i + 1), 14));
    }
    const slope = (atrs[atrs.length - 1] - atrs[0]) / (atrs.length - 1);
    const threshold = atrs[0] * 0.02; // 2% of ATR as noise floor
    let momentum: VolatilityMomentum;
    if (slope > threshold) momentum = 'expanding';
    else if (slope < -threshold) momentum = 'contracting';
    else momentum = 'flat';
    return { momentum, slope: +slope.toFixed(8) };
  }

  // ── Main: analyze a single pair ──────────────────────────────────────────

  async analyzePair(pair: string, cotNetPositions?: number[]): Promise<MlResult> {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const candles = await this.ohlcvRepo.find({
      where: { pair, timeframe: 'daily', timestamp: MoreThan(since.getTime()) as any },
      order: { timestamp: 'ASC' },
    });

    if (candles.length < 20) {
      return {
        pair,
        knnRegime: 'ranging',
        volatilityCluster: 'medium',
        volatilityMomentum: 'flat',
        atrSlope5d: 0,
        cotPercentile: null,
        knnConfidence: 0,
        directionalEfficiency: 0,
        atrRatio: 1,
        implication: 'Insufficient historical data — ML models unavailable, using defaults.',
      };
    }

    // Build feature history from rolling windows (used for volatility clustering)
    const windowSize = 30;
    const featureHistory: FeatureVector[] = [];
    for (let i = windowSize; i < candles.length - 1; i++) {
      featureHistory.push(this.extractFeatures(candles.slice(i - windowSize, i)));
    }

    const currentFeatures = this.extractFeatures(candles);
    const { regime, confidence } = this.classifyRegime(candles, currentFeatures);

    // Кластеризація волатильності по ATR% (а не по atrRatio).
    //
    // БУЛО: передавався atrRatio з featureHistory — лише кілька значень
    // (вікно 30 свічок), тому майже завжди спрацьовував fallback-гілка
    // "ratio > 2.0 → crisis", і ВСІ пари показувались як crisis (виявлено
    // 2026-07-20 на живих даних).
    //
    // СТАЛО: ковзний ATR% по всій доступній історії — та сама величина, на
    // якій калібрувались пороги режиму, і достатньо точок для k-means.
    const atrPctHistory: number[] = [];
    for (let i = 20; i <= candles.length; i++) {
      const pct = this.computeAtrPct(candles.slice(0, i));
      if (pct !== null) atrPctHistory.push(pct);
    }
    const currentAtrPct = this.computeAtrPct(candles);
    const volatilityCluster = this.classifyVolatilityCluster(
      currentAtrPct ?? atrPctHistory[atrPctHistory.length - 1] ?? 0,
      atrPctHistory,
    );

    const cotPercentile = cotNetPositions && cotNetPositions.length > 4
      ? this.computePercentile(cotNetPositions.slice(0, -1), cotNetPositions[cotNetPositions.length - 1])
      : null;

    const { momentum: volatilityMomentum, slope: atrSlope5d } = this.computeVolatilityMomentum(candles);

    const result: MlResult = {
      pair,
      knnRegime: regime,
      volatilityCluster,
      volatilityMomentum,
      atrSlope5d,
      cotPercentile,
      knnConfidence: confidence,
      directionalEfficiency: +currentFeatures.directionalEfficiency.toFixed(3),
      atrRatio: +currentFeatures.atrRatio.toFixed(3),
      implication: this.buildImplication(regime, volatilityCluster, cotPercentile),
    };

    // Persist to DB
    const today = new Date().toISOString().slice(0, 10);
    const label = this.regimeRepo.create({
      pair,
      date: today,
      knnRegime: regime,
      volatilityCluster,
      cotPercentile: cotPercentile ?? undefined,
      knnConfidence: confidence,
      directionalEfficiency: currentFeatures.directionalEfficiency,
      atrRatio: currentFeatures.atrRatio,
    });
    await this.regimeRepo.save(label);

    return result;
  }

  async analyzeAll(): Promise<MlResult[]> {
    const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD', 'USD/CAD', 'USD/CHF', 'GBP/JPY'];
    return Promise.all(pairs.map(p => this.analyzePair(p)));
  }
}
