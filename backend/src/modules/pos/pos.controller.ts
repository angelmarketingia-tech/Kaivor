import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PosService } from './pos.service';

@Controller('pos')
@UseGuards(AuthGuard('jwt'))
export class PosController {
  constructor(private pos: PosService) {}

  @Get('live-stats')
  liveStats(@Request() req: any) {
    return this.pos.liveStats(req.user.tenantId);
  }

  @Get('sales-analytics')
  salesAnalytics(@Request() req: any, @Query('days') days?: string) {
    const d = Math.min(90, Math.max(7, parseInt(days || '30') || 30));
    return this.pos.salesAnalytics(req.user.tenantId, d);
  }

  @Get('suggestions')
  suggestions(@Request() req: any) {
    return this.pos.suggestions(req.user.tenantId);
  }
}
