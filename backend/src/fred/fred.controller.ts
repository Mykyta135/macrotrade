import { Controller, Get } from '@nestjs/common';
import { FredService } from './fred.service';

@Controller('fred')
export class FredController {
  constructor(private readonly fredService: FredService) {}

  @Get()
  getFredData() {
    return this.fredService.getFredData();
  }
}
