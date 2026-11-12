import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MacroModule } from './macro/macro.module';
import { SentimentModule } from './sentiment/sentiment.module';
import { CotModule } from './cot/cot.module';
import { CalendarModule } from './calendar/calendar.module';
import { FredModule } from './fred/fred.module';
import { ScoreModule } from './score/score.module';
import { TechnicalModule } from './technical/technical.module';
import { DatabaseModule } from './database/database.module';
import { MlModule } from './ml/ml.module';
import { JournalModule } from './journal/journal.module';
import { BacktestModule } from './backtest/backtest.module';
import { ChartModule } from './chart/chart.module';
import { CommonModule } from './common/common.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    DatabaseModule,
    MacroModule,
    SentimentModule,
    CotModule,
    CalendarModule,
    FredModule,
    ScoreModule,
    TechnicalModule,
    MlModule,
    JournalModule,
    BacktestModule,
    ChartModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
