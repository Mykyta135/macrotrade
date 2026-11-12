import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * ОДИН smoke-тест замість e2e на кожен юзкейс.
 *
 * ЧОМУ САМЕ ТАК:
 * E2E на кожен сценарій для проєкту, який ведеться наодинці, — пастка. Вони
 * повільні, ламаються від будь-якої зміни верстки, і після перерви в кілька
 * місяців червоні тести починають ігнорувати замість лагодити.
 *
 * Цей тест перевіряє рівно одне: застосунок піднімається, модулі зв'язані,
 * ключові ендпоінти відповідають і віддають структурно валідні дані. Саме це
 * ламається найчастіше — зміна схеми БД, забутий провайдер, циклічна залежність.
 *
 * УВАГА: тест ходить у РЕАЛЬНІ зовнішні API (Yahoo, FRED, CFTC) і потребує
 * піднятого Postgres. Це свідомо: моки тут показували б зелене світло навіть
 * тоді, коли Yahoo змінив символ. Тому таймаути великі.
 * Запуск: npm run test:e2e
 */
describe('Smoke — застосунок живий (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/score — 8 пар з валідними вердиктами', async () => {
    const res = await request(app.getHttpServer()).get('/api/score').expect(200);

    expect(res.body.pairs).toHaveLength(8);

    for (const p of res.body.pairs) {
      expect(['BUY', 'SELL', 'WATCH', 'NO TRADE']).toContain(p.direction);
      expect(p.maxScore).toBe(5);
      expect(p.totalScore).toBeGreaterThanOrEqual(0);
      expect(p.totalScore).toBeLessThanOrEqual(5);
      expect(p.killSwitches.length).toBeGreaterThan(0);
      expect(typeof p.tradeRecommendation).toBe('string');

      // Головний інваріант системи: вето перекриває бали
      if (p.killSwitchBlocked) {
        expect(['WATCH', 'NO TRADE']).toContain(p.direction);
      }
    }
  }, 120_000);

  it('GET /api/health — повідомляє про стан джерел', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(['ok', 'degraded', 'broken']).toContain(res.body.state);
    expect(Array.isArray(res.body.issues)).toBe(true);

    // Кожна проблема має бути дією, а не просто фактом
    for (const i of res.body.issues) {
      expect(i.message.length).toBeGreaterThan(10);
      expect(['ok', 'degraded', 'broken']).toContain(i.state);
    }
  }, 120_000);

  it('GET /api/macro — індикатори мають ненульові ціни', async () => {
    const res = await request(app.getHttpServer()).get('/api/macro').expect(200);

    // DXY і VIX — основа всієї системи; якщо вони нульові, все решта беззмістовне
    expect(res.body.dxy.price).toBeGreaterThan(0);
    expect(res.body.vix.price).toBeGreaterThan(0);
    expect(res.body.pairADR.length).toBeGreaterThan(0);
  }, 120_000);

  it('GET /api/fred — макроряди присутні', async () => {
    const res = await request(app.getHttpServer()).get('/api/fred').expect(200);
    expect(res.body.us2y).toBeDefined();
    expect(res.body.yieldCurve).toBeDefined();
    expect(typeof res.body.liquidityRegime).toBe('string');
  }, 60_000);

  it('GET /api/ml — режим по кожній парі', async () => {
    const res = await request(app.getHttpServer()).get('/api/ml').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const r of res.body) {
      expect(['trending', 'ranging', 'volatile', 'crisis']).toContain(r.knnRegime);
    }
  }, 120_000);

  it('GET /api/journal — CRUD-ендпоінт відповідає (перевірка схеми БД)', async () => {
    await request(app.getHttpServer()).get('/api/journal').expect(200);
  }, 30_000);
});
