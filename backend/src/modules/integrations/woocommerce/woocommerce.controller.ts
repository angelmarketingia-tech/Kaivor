import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Headers,
  Req,
  RawBodyRequest,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WooCommerceService } from './woocommerce.service';
import { ConnectWooCommerceDto } from './dto/connect-woocommerce.dto';

@Controller('integrations')
export class WooCommerceController {
  constructor(private wooCommerceService: WooCommerceService) {}

  // ── Endpoints autenticados ──────────────────────────────────────────────────

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getIntegrations(@Request() req: any) {
    return this.wooCommerceService.getIntegrations(req.user.tenantId);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async getIntegration(@Request() req: any, @Param('id') id: string) {
    return this.wooCommerceService.getIntegration(id, req.user.tenantId);
  }

  @Get(':id/logs')
  @UseGuards(AuthGuard('jwt'))
  async getLogs(@Request() req: any, @Param('id') id: string) {
    return this.wooCommerceService.getLogs(id, req.user.tenantId);
  }

  @Post(':id/disconnect')
  @UseGuards(AuthGuard('jwt'))
  async disconnect(@Request() req: any, @Param('id') id: string) {
    return this.wooCommerceService.disconnect(id, req.user.tenantId);
  }

  @Post('woocommerce/connect')
  @UseGuards(AuthGuard('jwt'))
  async connect(@Request() req: any, @Body() dto: ConnectWooCommerceDto) {
    return this.wooCommerceService.connect(req.user.tenantId, dto);
  }

  @Post('woocommerce/test-connection')
  @UseGuards(AuthGuard('jwt'))
  async testConnection(@Request() req: any, @Body() dto: any) {
    return this.wooCommerceService.testConnection(req.user.tenantId, dto);
  }

  @Post('woocommerce/:id/sync')
  @UseGuards(AuthGuard('jwt'))
  async sync(@Request() req: any, @Param('id') id: string) {
    return this.wooCommerceService.syncOrders(id, req.user.tenantId);
  }

  // ── Webhook público (sin JWT — autenticado por firma HMAC) ─────────────────

  @Post('woocommerce/webhook/:integrationId')
  async receiveWebhook(
    @Param('integrationId') integrationId: string,
    @Headers('x-wc-webhook-topic') topic: string,
    @Headers('x-wc-webhook-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: any,
  ) {
    const rawBody = (req as any).rawBody ?? Buffer.from(JSON.stringify(payload));

    return this.wooCommerceService.processWebhook(
      integrationId,
      topic,
      rawBody,
      signature,
      payload,
    );
  }
}
