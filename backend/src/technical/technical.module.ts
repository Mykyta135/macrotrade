import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OhlcvFetcher } from './ohlcv.fetcher';
import { AnalysisService } from './analysis.service';
import { TechnicalService } from './technical.service';
import { TechnicalController } from './technical.controller';
import { OhlcvCandle } from '../database/entities/ohlcv-candle.entity';
import { TechnicalSnapshot } from '../database/entities/technical-snapshot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OhlcvCandle, TechnicalSnapshot])],
  providers: [OhlcvFetcher, AnalysisService, TechnicalService],
  controllers: [TechnicalController],
  exports: [TechnicalService, AnalysisService],
})
export class TechnicalModule {}
