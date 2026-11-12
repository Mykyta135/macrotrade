import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { JournalService } from './journal.service';
import type { CreateTradeDto, UpdateTradeDto } from './journal.service';

@Controller('journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Post()
  create(@Body() dto: CreateTradeDto) {
    return this.journalService.create(dto);
  }

  @Get()
  findAll(
    @Query('pair') pair?: string,
    @Query('outcome') outcome?: string,
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.journalService.findAll({
      pair,
      outcome,
      fromDate,
      toDate,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('stats')
  getStats() {
    return this.journalService.getStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.journalService.findOne(parseInt(id));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTradeDto) {
    return this.journalService.update(parseInt(id), dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.journalService.delete(parseInt(id));
  }
}
