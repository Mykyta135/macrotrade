import { Controller, Get } from '@nestjs/common';
import { MacroService } from './macro.service';

@Controller('macro')
export class MacroController {
  constructor(private readonly macroService: MacroService) {}

  @Get()
  getMacroData() {
    return this.macroService.getMacroData();
  }
}
