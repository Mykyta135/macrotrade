import { Controller, Get, Param, Query } from '@nestjs/common';
import { MlService } from './ml.service';
import { RegimeService } from './regime.service';

@Controller('ml')
export class MlController {
  constructor(
    private readonly mlService: MlService,
    private readonly regimeService: RegimeService,
  ) {}

  @Get()
  getAll() {
    return this.mlService.analyzeAll();
  }

  @Get('regime/all')
  getAllRegime() {
    return this.regimeService.buildAllPayloads();
  }

  @Get('regime/:pair')
  getRegimePair(
    @Param('pair') pair: string,
    @Query('systemDirection') systemDirection?: string,
    @Query('cbBias') cbBias?: string,
    @Query('liquidityRegime') liquidityRegime?: string,
    @Query('realYieldTrend') realYieldTrend?: string,
    @Query('dangerZoneActive') dangerZoneActive?: string,
    @Query('retailLongPct') retailLongPct?: string,
    @Query('retailSignal') retailSignal?: string,
  ) {
    const normalizedPair = pair.replace('_', '/').toUpperCase();
    return this.regimeService.buildPayload(normalizedPair, {
      systemDirection: systemDirection || 'WATCH',
      cbBias: cbBias || undefined,
      liquidityRegime: liquidityRegime || undefined,
      realYieldTrend: realYieldTrend || undefined,
      dangerZoneActive: dangerZoneActive === 'true',
      retailLongPct: retailLongPct ? parseFloat(retailLongPct) : undefined,
      retailSignal: retailSignal || undefined,
    });
  }

  @Get(':pair')
  getPair(@Param('pair') pair: string) {
    const normalizedPair = pair.replace('_', '/').toUpperCase();
    return this.mlService.analyzePair(normalizedPair);
  }
}
