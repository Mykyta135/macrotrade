import { Controller, Get } from '@nestjs/common';
import { ScoreService } from './score.service';

@Controller('score')
export class ScoreController {
  constructor(private readonly scoreService: ScoreService) {}

  @Get()
  getScore() {
    return this.scoreService.getScoreData();
  }
}
