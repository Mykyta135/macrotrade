import { Module } from '@nestjs/common';
import { CotController } from './cot.controller';
import { CotService } from './cot.service';
import { CacheService } from '../common/cache.service';

@Module({
  controllers: [CotController],
  providers: [CotService, CacheService],
  exports: [CotService],
})
export class CotModule {}
