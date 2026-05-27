import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@UseGuards(AuthGuard('jwt'))
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get('current')
  async getCurrent(@Request() req: any) {
    return this.subscriptionsService.getCurrentSubscription(req.user.tenantId);
  }

  @Get('usage')
  async getUsage(@Request() req: any) {
    return this.subscriptionsService.getUsage(req.user.tenantId);
  }

  @Get('plans')
  async getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Post('change-plan')
  async changePlan(@Request() req: any, @Body('plan') plan: string) {
    return this.subscriptionsService.changePlan(req.user.tenantId, plan);
  }
}
