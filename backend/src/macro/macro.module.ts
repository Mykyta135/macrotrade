import { Module } from '@nestjs/common';
import { MacroController } from './macro.controller';
import { MacroService } from './macro.service';
import { CacheService } from '../common/cache.service';

@Module({
  controllers: [MacroController],
  providers: [MacroService, CacheService],
  exports: [MacroService],
})
export class MacroModule {}
