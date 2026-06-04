import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, Headers, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { WhatsappAgentService } from './whatsapp-agent.service';

@Controller('agents/whatsapp')
@UseGuards(AuthGuard('jwt'))
export class WhatsappAgentController {
  constructor(private agent: WhatsappAgentService) {}

  @Get('config')
  getConfig(@Request() req: any) {
    return this.agent.getConfig(req.user.tenantId);
  }

  @Patch('config')
  updateConfig(@Request() req: any, @Body() body: any) {
    return this.agent.updateConfig(req.user.tenantId, body);
  }

  @Get('conversations')
  listConversations(@Request() req: any) {
    return this.agent.listConversations(req.user.tenantId);
  }

  @Get('conversations/:id')
  async getConversation(@Request() req: any, @Param('id') id: string) {
    const conv = await this.agent.getConversation(req.user.tenantId, id);
    if (!conv) return { error: 'Conversación no encontrada' };
    return conv;
  }

  @Post('conversations/:id/takeover')
  takeOver(@Request() req: any, @Param('id') id: string) {
    return this.agent.takeOver(req.user.tenantId, id);
  }

  @Post('conversations/:id/release')
  release(@Request() req: any, @Param('id') id: string) {
    return this.agent.releaseToAgent(req.user.tenantId, id);
  }

  @Post('conversations/:id/send')
  sendAsHuman(@Request() req: any, @Param('id') id: string, @Body('content') content: string) {
    return this.agent.sendAsHuman(req.user.tenantId, id, content);
  }

  // ── Playground (sin Meta, para probar) ──
  @Post('test')
  testMessage(@Request() req: any, @Body() body: { message: string; phoneNumber?: string }) {
    return this.agent.testMessage(req.user.tenantId, body.message, body.phoneNumber);
  }

  @Post('test/reset')
  resetPlayground(@Request() req: any) {
    return this.agent.resetPlayground(req.user.tenantId);
  }

  // ── Validate Meta credentials (ping Graph API) ──
  @Post('validate')
  validate(@Request() req: any) {
    return this.agent.validateMetaCredentials(req.user.tenantId);
  }
}

// ── Public webhook (no auth) — verified by Meta verify token ──
@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  constructor(private agent: WhatsappAgentService) {}

  // Meta verification challenge: GET /webhooks/whatsapp/:tenantId?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
  @Throttle({ short: { limit: 30, ttl: 60000 } })
  @Get(':tenantId')
  async verify(
    @Param('tenantId') tenantId: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const result = await this.agent.verifyWebhook(tenantId, mode, verifyToken, challenge);
    if (result === null) return { error: 'verify_token mismatch' };
    return result;  // Meta expects the challenge plain
  }

  // Incoming message event — verifies X-Hub-Signature-256 HMAC if app secret is configured
  @Throttle({ short: { limit: 120, ttl: 60000 } })
  @Post(':tenantId')
  async receive(
    @Param('tenantId') tenantId: string,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() req: any,
    @Body() body: any,
  ) {
    const rawBody: Buffer | undefined = req.rawBody;
    return this.agent.ingestWebhook(tenantId, body, rawBody, signature);
  }
}
