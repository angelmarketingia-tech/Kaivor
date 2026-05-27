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

  @Post('branding/logo')
  async uploadLogo(@Request() req: any, @Body() body: any) {
    // Frontend sends { logoUrl: "data:image/...;base64,..." } or a URL.
    // For now we accept the URL/dataUrl directly; in production, store in S3/R2.
    if (!body.logoUrl) return { ok: false, error: 'logoUrl es requerido' };
    await this.settings.updateTenantSettings(req.user.tenantId, { logoUrl: body.logoUrl });
    return { ok: true, logoUrl: body.logoUrl };
  }

  @Post('branding/ai-optimize')
  async aiOptimize(@Request() req: any, @Body() body: any) {
    // Stub: returns suggested branding. Plan-gated.
    const sub = await (this.settings as any).prisma?.subscription?.findUnique?.({ where: { tenantId: req.user.tenantId } });
    const hasAI = ['PRO_AI', 'BUSINESS', 'ENTERPRISE'].includes(sub?.plan);
    if (!hasAI) {
      return { ok: false, teaser: true, message: 'La optimización con IA está disponible en planes superiores.' };
    }
    return {
      ok: true,
      suggestions: {
        primaryColor: '#7c3aed',
        receiptFooter: 'Gracias por tu compra. Síguenos en redes.',
      },
    };
  }
}
