import { Test } from '@nestjs/testing';
import { SentimentService } from './sentiment.service';
import { CotService, CotPosition } from '../cot/cot.service';
import { CacheService } from '../common/cache.service';
import { DataHealthService } from '../common/data-health.service';

/**
 * Тести настроїв роздрібу на базі CFTC `nonrept` (замінили Myfxbook 2026-07-21).
 *
 * ГОЛОВНЕ, ЩО ТУТ ПЕРЕВІРЯЄТЬСЯ: настрої більше НЕ є похідною від COT.
 * Раніше retailLongPct = 100 - institutionalLongPct, тобто фактор просто
 * інвертував ті самі дані, які вже оцінені фактором COT (подвійний рахунок).
 * Тепер це окремі поля того самого звіту — незалежний зріз.
 */
describe('SentimentService — роздріб із CFTC nonrept', () => {
  const buildCot = (over: Partial<CotPosition> = {}): CotPosition => ({
    currency: 'EUR', pair: 'EUR/USD',
    nonCommercialLong: 100_000, nonCommercialShort: 100_000,
    openInterest: 500_000, prevOpenInterest: 500_000,
    netPosition: 0, prevNetPosition: 0, weeklyChange: 0, velocity3w: 0,
    oiDivergence: 'none', specsLiquidationRisk: 'low',
    futuresConfirmation: {
      quality: 'neutral', oiChange: 0, oiChangePct: 0,
      newLongsAdded: 0, newShortsAdded: 0, implication: '',
    },
    nonReportableLong: 35_137, nonReportableShort: 17_240,   // реальні числа з CFTC
    bias: 'neutral', signal: '', reportDate: '2026-07-14', netHistory: [],
    ...over,
  });

  async function build(positions: CotPosition[]) {
    const mod = await Test.createTestingModule({
      providers: [
        SentimentService,
        { provide: CacheService, useValue: { get: () => undefined, set: () => {} } },
        { provide: CotService, useValue: { getCotData: async () => ({ positions }) } },
        { provide: DataHealthService, useValue: { report: jest.fn(), clearSource: jest.fn() } },
      ],
    }).compile();
    const svc = mod.get(SentimentService);
    // Глушимо мережевий виклик Fear & Greed
    jest.spyOn(svc as any, 'fetchFearGreed').mockResolvedValue(null);
    return svc;
  }

  it('віддає РЕАЛЬНІ обсяги, а не нулі (ознака справжнього джерела)', async () => {
    const svc = await build([buildCot()]);
    const d = await svc.getSentimentData();
    const eur = d.pairs.find(p => p.symbol === 'EURUSD')!;

    expect(eur.longPositions).toBeGreaterThan(0);
    expect(eur.shortPositions).toBeGreaterThan(0);
  });

  it('НЕ є інверсією COT — це головна вимога до заміни', async () => {
    // Фонди сильно в лонгах, роздріб ТЕЖ у лонгах.
    // Стара логіка (100 - institutional) дала б роздріб у шортах — і це було б хибно.
    const svc = await build([buildCot({
      nonCommercialLong: 180_000, nonCommercialShort: 20_000,  // фонди 90% long
      nonReportableLong: 30_000, nonReportableShort: 10_000,   // роздріб 75% long
    })]);

    const eur = (await svc.getSentimentData()).pairs.find(p => p.symbol === 'EURUSD')!;

    // Роздріб має бути в лонгах, як у вихідних даних — а не інвертований
    expect(eur.longPct).toBeGreaterThan(60);
  });

  it('відсотки рахуються з nonrept, а не з noncomm', async () => {
    const svc = await build([buildCot({
      nonCommercialLong: 1, nonCommercialShort: 999_999,      // фонди майже всі в шортах
      nonReportableLong: 80, nonReportableShort: 20,          // роздріб 80% long
    })]);

    const eur = (await svc.getSentimentData()).pairs.find(p => p.symbol === 'EURUSD')!;
    expect(eur.longPct).toBe(80);
    expect(eur.shortPct).toBe(20);
  });

  it('перевертає позицію, коли валюта CFTC є котирувальною', async () => {
    // JPY — котирувальна в USD/JPY. Роздріб у лонгах по єні = шорт по USD/JPY.
    const svc = await build([buildCot({
      currency: 'JPY', pair: 'USD/JPY',
      nonReportableLong: 90, nonReportableShort: 10,   // 90% long JPY
    })]);

    const jpy = (await svc.getSentimentData()).pairs.find(p => p.symbol === 'USDJPY')!;
    expect(jpy.longPct).toBe(10);   // → 10% long USD/JPY
  });

  it('пропускає валюту без даних роздрібу замість ділення на нуль', async () => {
    const svc = await build([buildCot({ nonReportableLong: 0, nonReportableShort: 0 })]);
    const d = await svc.getSentimentData();
    expect(d.pairs.find(p => p.symbol === 'EURUSD')).toBeUndefined();
    expect(Array.isArray(d.pairs)).toBe(true);   // не падає
  });

  it('джерело в метаданих чесно називає CFTC, а не Myfxbook', async () => {
    const svc = await build([buildCot()]);
    const d = await svc.getSentimentData();
    expect(d.source).toMatch(/CFTC/i);
    expect(d.source).not.toMatch(/myfxbook/i);
  });

  it('сигнал fade будується проти натовпу', async () => {
    const svc = await build([buildCot({
      nonReportableLong: 85, nonReportableShort: 15,   // натовп у лонгах
    })]);
    const eur = (await svc.getSentimentData()).pairs.find(p => p.symbol === 'EURUSD')!;
    // Натовп у лонгах → сигнал має бути "згасити лонги"
    expect(eur.signal).toBe('fade-longs');
  });

  it('не падає на порожньому COT', async () => {
    const svc = await build([]);
    const d = await svc.getSentimentData();
    expect(d.pairs).toEqual([]);
  });
});
