import { Module } from '@nestjs/common';
import { FredController } from './fred.controller';
import { FredService } from './fred.service';
import { CacheService } from '../common/cache.service';

@Module({
  controllers: [FredController],
  providers: [FredService, CacheService],
  exports: [FredService],
})
export class FredModule {}
