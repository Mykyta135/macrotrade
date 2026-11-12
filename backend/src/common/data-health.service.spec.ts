import { DataHealthService } from './data-health.service';

/**
 * Тести валідатора. Тут моки доречні: перевіряємо саму логіку виявлення,
 * а не зовнішні API.
 */
describe('DataHealthService', () => {
  let health: DataHealthService;

  beforeEach(() => {
    health = new DataHealthService();
    // Глушимо логер, щоб не смітити у вивід тестів
    jest.spyOn((health as any).logger, 'warn').mockImplementation(() => {});
    jest.spyOn((health as any).logger, 'error').mockImplementation(() => {});
  });

  describe('checkPrice — реальний баг USD/CNH', () => {
    it('ціна 0 = зламане джерело', () => {
      expect(health.checkPrice('macro', 'usdcnh', 0, ['AUD/USD'])).toBe(false);
      const [issue] = health.getIssues();
      expect(issue.state).toBe('broken');
      expect(issue.field).toBe('usdcnh');
      expect(issue.affects).toContain('AUD/USD');
    });

    it('нормальна ціна проблем не створює', () => {
      expect(health.checkPrice('macro', 'dxy', 100.96)).toBe(true);
      expect(health.getIssues()).toHaveLength(0);
    });

    it('NaN, Infinity, undefined і null теж вважаються поломкою', () => {
      for (const bad of [NaN, Infinity, undefined, null]) {
        health = new DataHealthService();
        jest.spyOn((health as any).logger, 'error').mockImplementation(() => {});
        expect(health.checkPrice('macro', 'x', bad as any)).toBe(false);
      }
    });

    it('відновлення джерела прибирає проблему', () => {
      health.checkPrice('macro', 'usdcnh', 0);
      expect(health.getState()).toBe('broken');
      health.checkPrice('macro', 'usdcnh', 7.24);
      expect(health.getState()).toBe('ok');
    });
  });

  describe('агрегація стану', () => {
    it('broken важливіший за degraded', () => {
      health.report({ source: 'a', state: 'degraded', message: '' });
      health.report({ source: 'b', state: 'broken', message: '' });
      expect(health.getState()).toBe('broken');
    });

    it('без проблем стан ok', () => {
      expect(health.getState()).toBe('ok');
    });

    it('affectedPairs збирає пари без дублів', () => {
      health.report({ source: 'a', state: 'broken', message: '', affects: ['AUD/USD', 'NZD/USD'] });
      health.report({ source: 'b', state: 'degraded', message: '', affects: ['AUD/USD'] });
      expect(health.getAffectedPairs().sort()).toEqual(['AUD/USD', 'NZD/USD']);
    });

    it('повторний звіт про ту саму проблему не дублюється', () => {
      health.report({ source: 'macro', field: 'usdcnh', state: 'broken', message: 'x' });
      health.report({ source: 'macro', field: 'usdcnh', state: 'broken', message: 'x' });
      expect(health.getIssues()).toHaveLength(1);
    });
  });

  describe('checkFreshness', () => {
    it('свіжі дані проходять', () => {
      expect(health.checkFreshness('fred', 'us2y', new Date().toISOString(), 24)).toBe(true);
    });

    it('застарілі дані дають degraded', () => {
      const old = new Date(Date.now() - 72 * 3_600_000).toISOString();
      expect(health.checkFreshness('fred', 'cpi', old, 24)).toBe(false);
      expect(health.getState()).toBe('degraded');
    });

    it('відсутня дата не вважається помилкою', () => {
      expect(health.checkFreshness('fred', 'x', null, 24)).toBe(true);
    });
  });
});
