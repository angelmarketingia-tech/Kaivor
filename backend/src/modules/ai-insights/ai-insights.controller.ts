import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AiInsightsService } from './ai-insights.service';
import { PermissionsGuard, RequirePermissions } from '@/common/permissions.guard';

@Controller('ai-insights')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@RequirePermissions('ai.use')
export class AiInsightsController {
  constructor(private aiInsightsService: AiInsightsService) {}

  @Get('monthly-summary')
  async getMonthlySummary(@Request() req: any) {
    return this.aiInsightsService.getMonthlySummary(req.user.tenantId);
  }

  @Post('invoice-check')
  async checkInvoice(@Request() req: any, @Body() invoiceData: any) {
    return this.aiInsightsService.checkInvoice(req.user.tenantId, invoiceData);
  }

  @Get('recommendations')
  async getRecommendations(@Request() req: any) {
    return this.aiInsightsService.getRecommendations(req.user.tenantId);
  }
}
