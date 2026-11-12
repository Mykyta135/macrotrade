import { Module } from '@nestjs/common';
import { ScoreController } from './score.controller';
import { ScoreService } from './score.service';
import { MacroModule } from '../macro/macro.module';
import { SentimentModule } from '../sentiment/sentiment.module';
import { CotModule } from '../cot/cot.module';
import { CalendarModule } from '../calendar/calendar.module';
import { FredModule } from '../fred/fred.module';

@Module({
  imports: [MacroModule, SentimentModule, CotModule, CalendarModule, FredModule],
  controllers: [ScoreController],
  providers: [ScoreService],
})
export class ScoreModule {}
