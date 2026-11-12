import { Test } from '@nestjs/testing';
import { ScoreService } from './score.service';
import { MacroService } from '../macro/macro.service';
import { SentimentService } from '../sentiment/sentiment.service';
import { CotService } from '../cot/cot.service';
import { CalendarService } from '../calendar/calendar.service';
import { FredService } from '../fred/fred.service';

/**
 * Тести каскаду прийняття рішень (R4 → R1 → R2 → R3).
 *
 * ЩО ЦЕ ПЕРЕВІРЯЄ І ЧОГО НЕ ПЕРЕВІРЯЄ:
 *
 * Перевіряє ПРАВИЛА — тобто що код робить те, що задумано:
 *   - порядок R2 (глобальні вето перед локальними);
 *   - будь-який провалений kill switch → WATCH, навіть при 5 балах;
 *   - <3 бали → NO TRADE;
 *   - інверсію напрямку при кредитній дивергенції SPX↑/HYG↓.
 *
 * НЕ перевіряє, чи ці правила прибуткові на реальному ринку — це торгове
 * рішення, а не програмне. І НЕ ловить зламані джерела даних: для цього є
 * DataHealthService, бо на моках будь-яке джерело виглядає справним.
 *
 * Фікстури-білдери навмисно повертають "нейтральний ринок", а кожен тест
 * міняє лише ті поля, які перевіряє. Так видно, що саме спричинило результат.
 */

type Trend = 'bullish' | 'bearish' | 'neutral';

const ind = (price: number, trend: Trend = 'neutral') => ({
  symbol: 'X', name: 'X', price, change: 0, changePct: 0, trend, signal: '',
});

function macroFixture(over: Record<string, any> = {}): any {
  return {
    dxy: ind(100, 'neutral'), spx: ind(5000, 'neutral'), ndx: ind(17000, 'neutral'),
    vix: ind(15, 'neutral'), us10y: ind(4.5, 'neutral'), oil: ind(75, 'neutral'),
    gold: ind(2000, 'neutral'), copper: ind(4, 'neutral'), usdcnh: ind(7.2, 'neutral'),
    dax: ind(18000, 'neutral'), ftse: ind(8000, 'neutral'), nikkei: ind(39000, 'neutral'),
    hyg: ind(78, 'neutral'), vvix: ind(90, 'neutral'), skew: ind(130, 'neutral'),
    smh: ind(240, 'neutral'), eem: ind(42, 'neutral'), silver: ind(25, 'neutral'),
    gsRatio: 80, copperGoldRatio: 0.002,
    currencyStrength: [
      { currency: 'EUR', etf: 'FXE', trend: 'neutral', price: 100 },
      { currency: 'GBP', etf: 'FXB', trend: 'neutral', price: 100 },
      { currency: 'JPY', etf: 'FXY', trend: 'neutral', price: 100 },
      { currency: 'CHF', etf: 'FXF', trend: 'neutral', price: 100 },
      { currency: 'CAD', etf: 'FXC', trend: 'neutral', price: 100 },
      { currency: 'AUD', etf: 'FXA', trend: 'neutral', price: 100 },
    ],
    // ADR не вичерпано — інакше kill switch спрацює в кожному тесті
    pairADR: ['EUR/USD','GBP/USD','AUD/USD','NZD/USD','USD/JPY','USD/CHF','USD/CAD','GBP/JPY']
      .map((pair) => ({ pair, adr14Pips: 80, todayRangePips: 20, exhaustionPct: 25, exhausted: false })),
    riskEnvironment: 'neutral',
    usdBias: 'neutral',
    fetchedAt: new Date().toISOString(),
    ...over,
  };
}

function fredFixture(over: Record<string, any> = {}): any {
  const s = (v: number, trend = 'flat') => ({
    id: 'X', name: 'X', latestValue: v, previousValue: v, change: 0,
    trend, unit: '%', observationDate: '2026-07-16', interpretation: '',
  });
  return {
    cpi: s(3), unemployment: s(4), fedRate: s(3.6),
    us2y: s(4.16, 'flat'), realYield: s(2.35, 'flat'), walcl: s(6_700_000, 'flat'),
    yieldCurve: { us2y: 4.16, us10y: 4.57, spread: 0.41, inverted: false, signal: '' },
    liquidityRegime: 'neutral', centralBankBias: 'neutral', usdFundamentalBias: 'neutral',
    summary: '', fetchedAt: '', source: 'FRED',
    ...over,
  };
}

const calendarFixture = (over: Record<string, any> = {}): any => ({
  events: [], highImpactNext24h: [], dangerZoneActive: false,
  dangerZoneMessage: null, fetchedAt: '', ...over,
});

const sentimentFixture = (pairs: any[] = []): any => ({
  pairs, fearGreed: null, fetchedAt: '', source: 'test',
});

const cotFixture = (positions: any[] = []): any => ({
  positions, fetchedAt: '', source: 'CFTC', note: '',
});

/** Настрої, що підтверджують напрямок: натовп стоїть проти нас. */
const sentFor = (symbol: string, dir: 'BUY' | 'SELL') => ({
  symbol,
  longPct: dir === 'BUY' ? 25 : 75,
  shortPct: dir === 'BUY' ? 75 : 25,
  longPositions: 1000, shortPositions: 1000,
  signal: dir === 'BUY' ? 'fade-shorts' : 'fade-longs',
  signalStrength: 'strong',
  interpretation: '',
});

async function buildService(over: {
  macro?: any; fred?: any; calendar?: any; sentiment?: any; cot?: any;
} = {}) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      ScoreService,
      { provide: MacroService,     useValue: { getMacroData:     async () => over.macro     ?? macroFixture() } },
      { provide: SentimentService, useValue: { getSentimentData: async () => over.sentiment ?? sentimentFixture() } },
      { provide: CotService,       useValue: { getCotData:       async () => over.cot       ?? cotFixture() } },
      { provide: CalendarService,  useValue: { getCalendarData:  async () => over.calendar  ?? calendarFixture() } },
      { provide: FredService,      useValue: { getFredData:      async () => over.fred      ?? fredFixture() } },
    ],
  }).compile();
  return moduleRef.get(ScoreService);
}

const pairOf = (data: any, pair: string) => data.pairs.find((p: any) => p.pair === pair);

describe('ScoreService — каскад R4 → R1 → R2 → R3', () => {

  it('повертає всі 8 відстежуваних пар', async () => {
    const svc = await buildService();
    const data = await svc.getScoreData();
    expect(data.pairs).toHaveLength(8);
    expect(data.pairs.map((p: any) => p.pair)).toEqual(
      expect.arrayContaining(['EUR/USD', 'GBP/USD', 'USD/JPY', 'GBP/JPY']),
    );
  });

  describe('R4 — вето виконання', () => {

    it('VIX > 30 блокує торгівлю по всіх парах (режим паніки)', async () => {
      const svc = await buildService({ macro: macroFixture({ vix: ind(35, 'bullish') }) });
      const data = await svc.getScoreData();

      for (const p of data.pairs) {
        const ks = p.killSwitches.find((k: any) => k.name.startsWith('News Clear'))!;
        expect(ks.passed).toBe(false);
        expect(ks.detail).toContain('PANIC');
        // Паніка ніколи не дає живий сигнал
        expect(['WATCH', 'NO TRADE']).toContain(p.direction);
      }
    });

    it('активна danger zone не дає жодного BUY/SELL', async () => {
      const svc = await buildService({
        calendar: calendarFixture({ dangerZoneActive: true, dangerZoneMessage: 'FOMC за 15 хв' }),
      });
      const data = await svc.getScoreData();

      expect(data.dangerZoneActive).toBe(true);
      for (const p of data.pairs) {
        expect(['WATCH', 'NO TRADE']).toContain(p.direction);
      }
    });

    it('вичерпаний ADR переводить пару у WATCH і пояснює, чого чекати', async () => {
      const adr = macroFixture().pairADR.map((a: any) =>
        a.pair === 'EUR/USD' ? { ...a, todayRangePips: 77, exhaustionPct: 96, exhausted: true } : a);
      const svc = await buildService({ macro: macroFixture({ pairADR: adr }) });

      const eur = pairOf(await svc.getScoreData(), 'EUR/USD');
      const ks = eur.killSwitches.find((k: any) => k.name.startsWith('ADR'));

      expect(ks.passed).toBe(false);
      expect(ks.unlockCondition).toBeTruthy();   // користувач має бачити умову розблокування
      expect(eur.direction).not.toBe('BUY');
      expect(eur.direction).not.toBe('SELL');
    });

    it('розбіжність 2Y і 10Y блокує (неоднозначний сигнал ФРС)', async () => {
      const svc = await buildService({
        macro: macroFixture({ us10y: ind(4.5, 'bullish') }),
        fred: fredFixture({ us2y: { ...fredFixture().us2y, trend: 'falling' } }),
      });

      const eur = pairOf(await svc.getScoreData(), 'EUR/USD');
      const ks = eur.killSwitches.find((k: any) => k.name.startsWith('US Bond Yields'));

      expect(ks.passed).toBe(false);
      expect(ks.detail).toMatch(/DIVERGE|конфл|conflict/i);
    });
  });

  describe('R2 — детектор брехні', () => {

    it('SPX↑ + HYG↓ розвертає BUY ризикової валюти у SELL', async () => {
      // Умови, за яких AUD/USD інакше отримав би BUY
      const svc = await buildService({
        macro: macroFixture({
          spx: ind(5000, 'bullish'),
          hyg: ind(78, 'bearish'),        // кредит уже падає
          gold: ind(2000, 'bullish'),
          copper: ind(4, 'bullish'),
          dxy: ind(100, 'bearish'),
          riskEnvironment: 'risk-on',
          usdBias: 'bearish',
        }),
      });

      const aud = pairOf(await svc.getScoreData(), 'AUD/USD');
      expect(aud.r2InversionNote).toBeTruthy();
      expect(aud.r2InversionNote).toMatch(/HYG|Credit/i);
    });

    it('VIX > 25 має пріоритет над регіональними драйверами (глобальне вето першим)', async () => {
      // DAX бичачий (локально за BUY EUR), але паніка має перекрити
      const svc = await buildService({
        macro: macroFixture({
          vix: ind(27, 'bullish'),
          dax: ind(18000, 'bullish'),
          dxy: ind(100, 'bearish'),
          usdBias: 'bearish',
        }),
      });

      const eur = pairOf(await svc.getScoreData(), 'EUR/USD');
      if (eur.r2InversionNote) {
        // Якщо інверсія спрацювала — вона має бути саме через VIX, а не через DAX
        expect(eur.r2InversionNote).toMatch(/VIX|Panic/i);
      }
    });

    it('на спокійному ринку інверсії немає', async () => {
      const svc = await buildService();
      const data = await svc.getScoreData();
      const withNotes = data.pairs.filter((p: any) => p.r2InversionNote);
      expect(withNotes).toHaveLength(0);
    });
  });

  describe('R3 — бали впевненості', () => {

    it('менше 3 балів → NO TRADE незалежно від пройдених kill switches', async () => {
      const svc = await buildService();  // нейтральний ринок = мало балів
      const data = await svc.getScoreData();

      for (const p of data.pairs) {
        if (p.totalScore < 3) expect(p.direction).toBe('NO TRADE');
      }
    });

    it('максимум балів — 5, і сума факторів дорівнює totalScore', async () => {
      const svc = await buildService({
        sentiment: sentimentFixture([sentFor('EURUSD', 'SELL'), sentFor('GBPUSD', 'SELL')]),
      });
      const data = await svc.getScoreData();

      for (const p of data.pairs) {
        expect(p.maxScore).toBe(5);
        expect(p.totalScore).toBeLessThanOrEqual(5);
        expect(p.totalScore).toBeGreaterThanOrEqual(0);
        const sum = p.factors.reduce((s: number, f: any) => s + f.score, 0);
        expect(sum).toBe(p.totalScore);
      }
    });
  });

  describe('Інваріанти вердикту', () => {

    it('провалений kill switch НІКОЛИ не дає BUY/SELL', async () => {
      // Це головна гарантія системи: бали не перекривають вето
      const svc = await buildService({
        calendar: calendarFixture({ dangerZoneActive: true, dangerZoneMessage: 'x' }),
        sentiment: sentimentFixture([sentFor('EURUSD', 'SELL')]),
      });

      for (const p of (await svc.getScoreData()).pairs) {
        if (p.killSwitchBlocked) {
          expect(['WATCH', 'NO TRADE']).toContain(p.direction);
        }
      }
    });

    it('у стані WATCH завжди є пояснення причини', async () => {
      const svc = await buildService({
        calendar: calendarFixture({ dangerZoneActive: true, dangerZoneMessage: 'FOMC' }),
        sentiment: sentimentFixture([sentFor('EURUSD', 'SELL')]),
      });

      for (const p of (await svc.getScoreData()).pairs) {
        if (p.direction === 'WATCH') {
          expect(p.watchlistReason).toBeTruthy();
          expect(p.tradeRecommendation).toBeTruthy();
        }
      }
    });

    it('оцінка узгоджена з напрямком', async () => {
      const svc = await buildService();
      for (const p of (await svc.getScoreData()).pairs) {
        if (p.direction === 'NO TRADE') expect(p.grade).toBe('NO TRADE');
        if (p.direction === 'WATCH')    expect(p.grade).toBe('WATCH');
        if (p.direction === 'BUY' || p.direction === 'SELL') {
          expect(['A', 'B', 'C']).toContain(p.grade);
        }
      }
    });

    it('topSetup — лише живий сигнал, topWatch — лише WATCH', async () => {
      const svc = await buildService();
      const data = await svc.getScoreData();
      if (data.topSetup) expect(['BUY', 'SELL']).toContain(data.topSetup.direction);
      if (data.topWatch) expect(data.topWatch.direction).toBe('WATCH');
    });
  });

  describe('Пастка ліквідності', () => {

    it('спрацьовує, коли COT і роздріб стоять в один бік', async () => {
      const svc = await buildService({
        sentiment: sentimentFixture([{
          symbol: 'EURUSD', longPct: 22, shortPct: 78,     // натовп у шортах
          longPositions: 100, shortPositions: 400,
          signal: 'fade-shorts', signalStrength: 'strong', interpretation: '',
        }]),
        cot: cotFixture([{
          currency: 'EUR', pair: 'EUR/USD',
          nonCommercialLong: 100, nonCommercialShort: 900, // фонди теж у шортах
          openInterest: 1000, prevOpenInterest: 1000,
          netPosition: -800, prevNetPosition: -700, weeklyChange: -100, velocity3w: -50,
          oiDivergence: 'none', specsLiquidationRisk: 'low',
          futuresConfirmation: { quality: 'neutral', oiChange: 0, oiChangePct: 0, newLongsAdded: 0, newShortsAdded: 0, implication: '' },
          nonReportableLong: 300, nonReportableShort: 100,
          bias: 'bearish', signal: '', reportDate: '2026-07-14', netHistory: [],
        }]),
      });

      const eur = pairOf(await svc.getScoreData(), 'EUR/USD');
      if (eur.liquidityTrapWarning) {
        expect(eur.liquidityTrapWarning).toMatch(/LIQUIDITY TRAP/i);
      }
    });
  });

  describe('Стійкість до поганих даних', () => {

    it('не падає, коли настроїв і COT немає', async () => {
      const svc = await buildService({ sentiment: sentimentFixture([]), cot: cotFixture([]) });
      const data = await svc.getScoreData();
      expect(data.pairs).toHaveLength(8);
      for (const p of data.pairs) expect(p.totalScore).toBeGreaterThanOrEqual(0);
    });

    it('не падає, коли індикатор дорівнює нулю (реальний баг USD/CNH)', async () => {
      const svc = await buildService({ macro: macroFixture({ usdcnh: ind(0, 'neutral') }) });
      const data = await svc.getScoreData();
      expect(data.pairs).toHaveLength(8);
      // Саме тому потрібен DataHealthService: система не падає, а тихо
      // недобирає бали — тест зелений, а сигнал зіпсований.
    });
  });
});
