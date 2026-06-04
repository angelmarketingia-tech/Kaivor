import { Controller, Get, Post, Patch, Delete, Body, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
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
  getPayments(@Request() req: any, @Query('logs') logs?: string) {
    return this.settings.getPaymentIntegrations(req.user.tenantId, logs);
  }

  @Patch('payment-integrations')
  savePayment(@Request() req: any, @Body() body: any) {
    return this.settings.savePaymentIntegration(req.user.tenantId, body);
  }

  @Post('payment-integrations')
  testPayment(@Request() req: any, @Body() body: any) {
    return this.settings.testPaymentIntegration(req.user.tenantId, body.provider);
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
    const res: any = await this.messages.testEmail(req.user.tenantId, body.to);
    if (res?.ok === false) {
      return { ok: false, message: res.error || 'No pudimos enviar el correo de prueba.' };
    }
    return { ok: true, sentTo: body.to, messageId: res?.messageId };
  }

  @Post('branding/logo')
  async uploadLogo(@Request() req: any, @Body() body: any) {
    // Frontend sends { logoData: "data:image/...;base64,...", fileName, width, height }.
    // Accept logoData (current frontend) or logoUrl (legacy) — store in the logoUrl column.
    const logo = body.logoData ?? body.logoUrl;
    if (!logo) throw new BadRequestException('No se recibió ninguna imagen de logo');
    await this.settings.updateTenantSettings(req.user.tenantId, { logoUrl: logo });
    return { ok: true, logoData: logo, logoUrl: logo };
  }

  @Delete('branding/logo')
  async deleteLogo(@Request() req: any) {
    await this.settings.updateTenantSettings(req.user.tenantId, { logoUrl: null });
    return { ok: true };
  }

  @Post('branding/ai-optimize')
  async aiOptimize(@Request() req: any, @Body() body: any) {
    // Stub: returns suggested branding. Plan-gated.
    const sub = await (this.settings as any).prisma?.subscription?.findUnique?.({ where: { tenantId: req.user.tenantId } });
    const hasAI = ['PRO_AI', 'BUSINESS', 'ENTERPRISE'].includes(sub?.plan);
    if (!hasAI) {
      return { ok: false, teaser: true, message: 'La optimización con IA está disponible en planes superiores.' };
    }
    // Flatten to the shape the frontend reads (res.data.recommendation/primaryColor/logoPosition/logoSize/invoiceTemplate).
    return {
      ok: true,
      recommendation: 'Logo a la izquierda con tamaño mediano y plantilla "moderno" para una factura limpia y profesional. Usa un color de acento consistente con tu logo.',
      primaryColor: '#7c3aed',
      logoPosition: 'left',
      logoSize: 'medium',
      invoiceTemplate: 'moderno',
    };
  }
}
