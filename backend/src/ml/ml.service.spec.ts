import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MlService } from './ml.service';
import { OhlcvCandle } from '../database/entities/ohlcv-candle.entity';
import { MlRegimeLabel } from '../database/entities/ml-regime-label.entity';
import { DataHealthService } from '../common/data-health.service';

/**
 * Тести класифікатора режиму (замінив KNN 2026-07-20).
 *
 * Перевіряємо саме те, що робить класифікатор придатним для торгівлі:
 *   - пороги відповідають калібруванню на історії;
 *   - впевненість чесна: близько до межі — низька;
 *   - детермінованість (той самий вхід → той самий вихід);
 *   - стійкість до вироджених даних.
 *
 * НЕ перевіряємо "точність" — стара модель показувала 94.7%, і це виявилось
 * витоком мітки. Точність без базової лінії — беззмістовне число.
 */
describe('MlService — класифікатор режиму', () => {
  let svc: MlService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        MlService,
        { provide: getRepositoryToken(OhlcvCandle), useValue: {} },
        { provide: getRepositoryToken(MlRegimeLabel), useValue: {} },
        { provide: DataHealthService, useValue: { report: jest.fn(), clearSource: jest.fn() } },
      ],
    }).compile();
    svc = mod.get(MlService);
  });

  /** Свічки із заданим ATR% від ціни — рівно та величина, на якій калібрувались пороги. */
  const candles = (atrPct: number, price = 1.0, n = 40, efficiency = 0.5): any[] => {
    const range = price * atrPct;
    const out: any[] = [];
    let close = price;
    for (let i = 0; i < n; i++) {
      // efficiency керує тим, наскільки рух спрямований
      const drift = range * efficiency * (i % 2 === 0 ? 1 : -1) * 0.1;
      const open = close;
      close = open + drift;
      out.push({
        time: i, open,
        high: Math.max(open, close) + range / 2,
        low: Math.min(open, close) - range / 2,
        close,
      });
    }
    return out;
  };

  const classify = (c: any[]) => (svc as any).classifyRegime(c, {
    atrRatio: 1, directionalEfficiency: 0.5, bodyRatio: 0.5,
  });

  describe('пороги відповідають калібруванню', () => {
    it('дуже низька волатильність → ranging', () => {
      const { regime } = classify(candles(0.003));   // нижче p33 (0.662%)
      expect(regime).toBe('ranging');
    });

    it('висока волатильність → volatile', () => {
      const { regime } = classify(candles(0.012));   // між p80 і p95
      expect(regime).toBe('volatile');
    });

    it('екстремальна волатильність → crisis', () => {
      const { regime } = classify(candles(0.020));   // вище p95 (1.387%)
      expect(regime).toBe('crisis');
    });

    it('порядок режимів монотонний за зростанням ATR%', () => {
      const order = ['ranging', 'trending', 'volatile', 'crisis'];
      const seq = [0.003, 0.008, 0.012, 0.020].map(v => classify(candles(v)).regime);
      // Кожен наступний режим не "легший" за попередній
      const idx = seq.map(r => order.indexOf(r));
      const volatilityRank = [idx[0], idx[2], idx[3]];  // ranging < volatile < crisis
      expect(volatilityRank[0]).toBeLessThan(volatilityRank[1]);
      expect(volatilityRank[1]).toBeLessThan(volatilityRank[2]);
    });
  });

  describe('впевненість чесна', () => {
    it('завжди в межах [0.35, 0.95] — не вдає точності, якої немає', () => {
      for (const v of [0.001, 0.005, 0.0066, 0.010, 0.0102, 0.014, 0.03]) {
        const { confidence } = classify(candles(v));
        expect(confidence).toBeGreaterThanOrEqual(0.35);
        expect(confidence).toBeLessThanOrEqual(0.95);
      }
    });

    it('біля порогу впевненість нижча, ніж далеко від нього', () => {
      const near = classify(candles(0.00663)).confidence;   // майже рівно p33
      const far = classify(candles(0.030)).confidence;      // глибоко в crisis
      expect(near).toBeLessThan(far);
    });

    it('НЕ повертає рівно 0.5 постійно (ознака старої заглушки)', () => {
      const vals = [0.002, 0.008, 0.012, 0.025].map(v => classify(candles(v)).confidence);
      expect(new Set(vals).size).toBeGreaterThan(1);
    });
  });

  describe('надійність', () => {
    it('детермінований — той самий вхід дає той самий вихід', () => {
      const c = candles(0.009);
      const a = classify(c), b = classify(c);
      expect(a).toEqual(b);
    });

    it('не падає на замалій кількості свічок', () => {
      const { regime, confidence } = classify(candles(0.01, 1.0, 5));
      expect(['trending', 'ranging', 'volatile', 'crisis']).toContain(regime);
      expect(confidence).toBeGreaterThan(0);
    });

    it('не падає на нульових цінах (реальний баг USD/CNH)', () => {
      const zero = Array.from({ length: 30 }, (_, i) => ({
        time: i, open: 0, high: 0, low: 0, close: 0,
      }));
      const { regime } = classify(zero);
      expect(['trending', 'ranging', 'volatile', 'crisis']).toContain(regime);
    });

    it('працює однаково для різних масштабів ціни (USD/JPY ≈ 150 vs EUR/USD ≈ 1.08)', () => {
      // ATR% нормалізований, тому режим має залежати від відносної, а не абсолютної волатильності
      const eur = classify(candles(0.012, 1.08)).regime;
      const jpy = classify(candles(0.012, 150)).regime;
      expect(eur).toBe(jpy);
    });
  });

  describe('k-means кластеризація волатильності', () => {
    const kmeans = (h: number[]) => (svc as any).kMeansVolatility(h);

    it('повертає 4 впорядковані центроїди', () => {
      const hist = Array.from({ length: 100 }, (_, i) => 0.001 + i * 0.0001);
      const { clusters, labels } = kmeans(hist);
      expect(clusters).toHaveLength(4);
      expect(labels).toEqual(['low', 'medium', 'high', 'crisis']);
      for (let i = 1; i < clusters.length; i++) {
        expect(clusters[i]).toBeGreaterThanOrEqual(clusters[i - 1]);
      }
    });

    it('детермінований — ініціалізація квантилями, а не випадкова', () => {
      const hist = Array.from({ length: 60 }, (_, i) => Math.sin(i) + 2);
      expect(kmeans(hist).clusters).toEqual(kmeans(hist).clusters);
    });

    it('не падає на порожній або короткій історії', () => {
      expect(kmeans([]).clusters).toHaveLength(4);
      expect(kmeans([0.01, 0.02]).clusters.length).toBeGreaterThan(0);
    });
  });
});
