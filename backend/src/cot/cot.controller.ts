import { Controller, Get } from '@nestjs/common';
import { CotService } from './cot.service';

@Controller('cot')
export class CotController {
  constructor(private readonly cotService: CotService) {}

  @Get()
  getCotData() {
    return this.cotService.getCotData();
  }
}
