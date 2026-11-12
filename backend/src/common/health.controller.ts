import { Controller, Get } from '@nestjs/common';
import { DataHealthService } from './data-health.service';
import { MacroService } from '../macro/macro.service';
import { SentimentService } from '../sentiment/sentiment.service';

/**
 * GET /api/health — стан джерел даних.
 *
 * Навмисно СПОЧАТКУ тягне macro та sentiment: перевірки виконуються під час
 * отримання даних, тож без цього виклику на щойно піднятому сервері список
 * проблем був би порожнім і створював хибне враження, що все гаразд.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: DataHealthService,
    private readonly macro: MacroService,
    private readonly sentiment: SentimentService,
  ) {}

  @Get()
  async get() {
    // Запускаємо перевірки (дані з кешу, якщо він свіжий — це дешево)
    await Promise.allSettled([
      this.macro.getMacroData(),
      this.sentiment.getSentimentData(),
    ]);

    const issues = this.health.getIssues();
    const state = this.health.getState();

    return {
      state,
      checkedAt: new Date().toISOString(),
      summary:
        state === 'ok'
          ? 'Усі джерела працюють.'
          : `${issues.filter((i) => i.state === 'broken').length} зламано, ` +
            `${issues.filter((i) => i.state === 'degraded').length} часткові.`,
      affectedPairs: this.health.getAffectedPairs(),
      issues,
    };
  }
}
