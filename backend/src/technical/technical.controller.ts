import { Controller, Get, Param, Query } from '@nestjs/common';
import { TechnicalService } from './technical.service';

@Controller('technical')
export class TechnicalController {
  constructor(private readonly technicalService: TechnicalService) {}

  @Get()
  getAll(@Query('refresh') refresh?: string) {
    return this.technicalService.analyzeAll(refresh === '1');
  }

  @Get(':pair')
  getPair(
    @Param('pair') pair: string,
    @Query('refresh') refresh?: string,
  ) {
    // Accept EUR_USD or EUR/USD format
    const normalizedPair = pair.replace('_', '/').toUpperCase();
    return this.technicalService.analyzePair(normalizedPair, refresh === '1');
  }
}
