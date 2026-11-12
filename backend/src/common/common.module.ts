import { Global, Module } from '@nestjs/common';
import { DataHealthService } from './data-health.service';

/**
 * Глобальний модуль: DataHealthService має бути ОДНИМ екземпляром на застосунок,
 * інакше кожен модуль накопичував би власний список проблем і /api/health
 * бачив би лише частину.
 *
 * CacheService свідомо НЕ тут — він реєструється в кожному модулі окремо, щоб
 * у сервісів були незалежні кеші (така поведінка вже закладена в коді).
 */
@Global()
@Module({
  providers: [DataHealthService],
  exports: [DataHealthService],
})
export class CommonModule {}
