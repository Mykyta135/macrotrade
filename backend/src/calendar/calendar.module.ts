import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CacheService } from '../common/cache.service';

@Module({
  controllers: [CalendarController],
  providers: [CalendarService, CacheService],
  exports: [CalendarService],
})
export class CalendarModule {}
