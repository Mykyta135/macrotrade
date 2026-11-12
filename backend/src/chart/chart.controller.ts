import { Controller, Get, Param, Query } from '@nestjs/common';
import { ChartService } from './chart.service';

@Controller('chart')
export class ChartController {
  constructor(private readonly chartService: ChartService) {}

  @Get('pairs')
  pairs() {
    return this.chartService.availablePairs();
  }

  @Get(':pair')
  chart(@Param('pair') pair: string, @Query('limit') limit?: string) {
    // Пара в URL приходить як EURUSD або EUR%2FUSD — нормалізуємо
    const normalized = pair.includes('/')
      ? pair
      : `${pair.slice(0, 3)}/${pair.slice(3)}`;
    return this.chartService.getChart(normalized, limit ? Number(limit) : 400);
  }
}
