import { Controller, Get, Post, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SettingsService } from './settings.service';
import { MessagesService } from '@/modules/messages/messages.service';

@Controller('settings')
@UseGuards(AuthGuard('jwt'))
export class SettingsController {
  constructor(
    private settings: SettingsService,
    private messages: MessagesService,
  ) {}

  @Get('tenant')
  getTenant(@Request() req: any) {
    return this.settings.getTenantSettings(req.user.tenantId);
  }

  @Patch('tenant')
  updateTenant(@Request() req: any, @Body() body: any) {
    return this.settings.updateTenantSettings(req.user.tenantId, body);
  }

  @Get('payment-integrations')
  getPayments(@Request() req: any) {
    return this.settings.getPaymentIntegrations(req.user.tenantId);
  }

  @Get('branding')
  getBranding(@Request() req: any) {
    return this.settings.getTenantSettings(req.user.tenantId);
  }

  @Patch('branding')
  updateBranding(@Request() req: any, @Body() body: any) {
    return this.settings.updateTenantSettings(req.user.tenantId, body);
  }

  @Post('email/test')
  async testEmail(@Request() req: any, @Body() body: any) {
    return this.messages.testEmail(req.user.tenantId, body.to);
  }
}
