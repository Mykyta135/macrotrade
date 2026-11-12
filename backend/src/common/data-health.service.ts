import { Injectable, Logger } from '@nestjs/common';

/**
 * DataHealthService — рантайм-валідація зовнішніх джерел.
 *
 * НАВІЩО ЦЕ ІСНУЄ (прочитайте перед тим, як прибирати):
 *
 * Юніт-тести на моках НЕ ловлять проблеми, заради яких написаний цей сервіс.
 * Мок Yahoo завжди повертає бездоганну відповідь — тому тест зелений, а на
 * проді USD/CNH віддає 0 і система тихо занижує бали по AUD/NZD пів року.
 *
 * Реальні випадки, які це має ловити (виявлені 2026-07-20):
 *   1. USD/CNH = 0 — символ USDCNH=X більше не працює на Yahoo;
 *   2. sentiment із longPositions=0 — джерело віддає похідні, а не реальні дані;
 *   3. KNN-модель не завантажилась — тихий fallback на прості правила.
 *
 * Тест каже про поломку, коли ви його запускаєте. Цей сервіс каже про неї
 * щоразу, коли ви відкриваєте дашборд. У цьому вся різниця.
 */

export type HealthState = 'ok' | 'degraded' | 'broken';

export interface HealthIssue {
  /** Джерело: 'macro', 'sentiment', 'ml', ... */
  source: string;
  /** Конкретне поле, якщо застосовно: 'usdcnh' */
  field?: string;
  state: HealthState;
  /** Пояснення українською — його бачить користувач у UI */
  message: string;
  /** Які торгові сигнали постраждали */
  affects?: string[];
}

@Injectable()
export class DataHealthService {
  private readonly logger = new Logger(DataHealthService.name);
  private readonly issues = new Map<string, HealthIssue>();

  /** Ключ, щоб не логувати ту саму проблему нескінченно. */
  private key(i: HealthIssue) {
    return `${i.source}:${i.field ?? '*'}`;
  }

  report(issue: HealthIssue): void {
    const k = this.key(issue);
    const known = this.issues.has(k);
    this.issues.set(k, issue);

    // Логуємо лише при першій появі — інакше 15-хвилинний кеш засмітить лог
    if (!known) {
      const line = `[${issue.source}${issue.field ? '.' + issue.field : ''}] ${issue.message}`;
      if (issue.state === 'broken') this.logger.error(line);
      else this.logger.warn(line);
    }
  }

  clear(source: string, field?: string): void {
    this.issues.delete(`${source}:${field ?? '*'}`);
  }

  /** Скидає всі проблеми джерела перед повторною перевіркою. */
  clearSource(source: string): void {
    for (const k of [...this.issues.keys()]) {
      if (k.startsWith(`${source}:`)) this.issues.delete(k);
    }
  }

  getIssues(): HealthIssue[] {
    return [...this.issues.values()];
  }

  getState(): HealthState {
    const all = this.getIssues();
    if (all.some((i) => i.state === 'broken')) return 'broken';
    if (all.some((i) => i.state === 'degraded')) return 'degraded';
    return 'ok';
  }

  /** Пари, чиї сигнали зачеплені зламаними джерелами. */
  getAffectedPairs(): string[] {
    const s = new Set<string>();
    for (const i of this.getIssues()) for (const p of i.affects ?? []) s.add(p);
    return [...s];
  }

  // ── Конкретні перевірки ────────────────────────────────────────────────

  /**
   * Ціна індикатора має бути додатнім скінченним числом.
   * Нуль тут — не «нейтрально», а «джерело мовчить»: тренд рахується від нуля
   * і правила R2/R3, зав'язані на цей індикатор, тихо перестають працювати.
   */
  checkPrice(
    source: string,
    field: string,
    price: number | undefined | null,
    affects: string[] = [],
  ): boolean {
    if (typeof price !== 'number' || !Number.isFinite(price) || price === 0) {
      this.report({
        source,
        field,
        state: 'broken',
        message:
          `Ціна = ${price}. Джерело не віддає дані — правила, що спираються на ` +
          `${field}, не спрацьовують (тренд рахується від нуля).`,
        affects,
      });
      return false;
    }
    this.clear(source, field);
    return true;
  }

  /** Дані старші за поріг — попередження, не поломка. */
  checkFreshness(source: string, field: string, iso: string | null | undefined, maxAgeHours: number): boolean {
    if (!iso) return true;
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return true;
    const ageH = (Date.now() - ts) / 3_600_000;
    if (ageH > maxAgeHours) {
      this.report({
        source,
        field,
        state: 'degraded',
        message: `Дані застарілі: ${Math.round(ageH)} год (норма — до ${maxAgeHours} год).`,
      });
      return false;
    }
    this.clear(source, field);
    return true;
  }
}
