import { Module } from '@nestjs/common';
import { SentimentController } from './sentiment.controller';
import { SentimentService } from './sentiment.service';
import { CacheService } from '../common/cache.service';
import { CotModule } from '../cot/cot.module';

@Module({
  imports: [CotModule],
  controllers: [SentimentController],
  providers: [SentimentService, CacheService],
  exports: [SentimentService],
})
export class SentimentModule {}
