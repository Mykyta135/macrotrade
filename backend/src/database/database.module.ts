import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OhlcvCandle } from './entities/ohlcv-candle.entity';
import { TechnicalSnapshot } from './entities/technical-snapshot.entity';
import { ReporterReport } from './entities/reporter-report.entity';
import { MlRegimeLabel } from './entities/ml-regime-label.entity';
import { TradeJournal } from './entities/trade-journal.entity';
import { CalendarEvent } from './entities/calendar-event.entity';
import { BacktestCache } from './entities/backtest-cache.entity';
import { AaiiSentiment } from './entities/aaii-sentiment.entity';
import { DailyVerdict } from './entities/daily-verdict.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        database: config.get('DB_NAME', 'macrotrade'),
        username: config.get('DB_USER', 'admin'),
        password: config.get('DB_PASSWORD', ''),
        entities: [OhlcvCandle, TechnicalSnapshot, ReporterReport, MlRegimeLabel, TradeJournal, CalendarEvent, BacktestCache, AaiiSentiment, DailyVerdict],
        synchronize: true,
        logging: false,
        extra: { max: 10, idleTimeoutMillis: 30000 },
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
