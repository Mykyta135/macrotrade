import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OhlcvCandle } from '../database/entities/ohlcv-candle.entity';
import { MlRegimeLabel } from '../database/entities/ml-regime-label.entity';
import { MlService } from './ml.service';
import { MlController } from './ml.controller';
import { RegimeService } from './regime.service';
import { TechnicalModule } from '../technical/technical.module';
import { MacroModule } from '../macro/macro.module';
import { CotModule } from '../cot/cot.module';
import { FredModule } from '../fred/fred.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OhlcvCandle, MlRegimeLabel]),
    TechnicalModule,
    MacroModule,
    CotModule,
    FredModule,
  ],
  providers: [MlService, RegimeService],
  controllers: [MlController],
  exports: [MlService, RegimeService],
})
export class MlModule {}
