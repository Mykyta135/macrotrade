import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChartController } from './chart.controller';
import { ChartService } from './chart.service';
import { OhlcvCandle } from '../database/entities/ohlcv-candle.entity';
import { DailyVerdict } from '../database/entities/daily-verdict.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OhlcvCandle, DailyVerdict])],
  controllers: [ChartController],
  providers: [ChartService],
  exports: [ChartService],
})
export class ChartModule {}
