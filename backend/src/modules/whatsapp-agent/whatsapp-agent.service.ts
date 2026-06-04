import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import OpenAI from 'openai';
import { PrismaService } from '@/prisma/prisma.service';
import { encrypt, decrypt } from '@/common/crypto.util';
import { TOOL_DEFINITIONS, executeTool } from './tools';

@Injectable()
export class WhatsappAgentService {
  private readonly logger = new Logger(WhatsappAgentService.name);

  constructor(private prisma: PrismaService) {}

  // ── Config CRUD ──

  async getConfig(tenantId: string) {
    let cfg = await this.prisma.whatsappAgentConfig.findUnique({ where: { tenantId } });
    if (!cfg) {
      cfg = await this.prisma.whatsappAgentConfig.create({ data: { tenantId } });
    }
    const apiBase = process.env.PUBLIC_API_URL || 'https://kaivor-api.vercel.app';
    return {
      enabled: cfg.enabled,
      agentName: cfg.agentName,
      systemPrompt: cfg.systemPrompt,
      model: cfg.model,
      temperature: cfg.temperature,
      monthlyMessageLimit: cfg.monthlyMessageLimit,
      monthlyMessageCount: cfg.monthlyMessageCount,
      monthlyResetAt: cfg.monthlyResetAt,
      metaPhoneNumberId: cfg.metaPhoneNumberId,
      metaWabaId: cfg.metaWabaId,
      hasAccessToken: !!cfg.metaAccessTokenEnc,
      hasAppSecret: !!cfg.metaAppSecretEnc,
      metaWebhookVerifyToken: cfg.metaWebhookVerifyToken,
      // Setup helpers — what the user needs to paste in Meta's dashboard
      tenantId,
      webhookCallbackUrl: `${apiBase}/webhooks/whatsapp/${tenantId}`,
    };
  }

  /**
   * Pings Meta Graph API with the saved credentials to confirm they work.
   * Returns the phone number's verified name and display number so user knows it's the right one.
   */
  async validateMetaCredentials(tenantId: string) {
    const cfg = await this.prisma.whatsappAgentConfig.findUnique({ where: { tenantId } });
    if (!cfg) return { ok: false, error: 'No hay configuración guardada' };
    if (!cfg.metaPhoneNumberId) return { ok: false, error: 'Falta metaPhoneNumberId' };
    if (!cfg.metaAccessTokenEnc) return { ok: false, error: 'Falta access token' };

    let token: string;
    try {
      token = decrypt(cfg.metaAccessTokenEnc);
    } catch {
      return { ok: false, error: 'No se pudo descifrar el access token (probablemente fue guardado con una clave de cifrado distinta).' };
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${cfg.metaPhoneNumberId}?fields=verified_name,display_phone_number,quality_rating`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data: any = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          error: data?.error?.message || `Meta respondió HTTP ${res.status}`,
          metaErrorCode: data?.error?.code,
          metaErrorType: data?.error?.type,
        };
      }
      return {
        ok: true,
        verifiedName: data.verified_name,
        displayPhoneNumber: data.display_phone_number,
        qualityRating: data.quality_rating,
      };
    } catch (e: any) {
      return { ok: false, error: `No se pudo contactar a Meta: ${e.message}` };
    }
  }

  async updateConfig(tenantId: string, data: any) {
    const update: any = {};
    const allowed = ['enabled', 'agentName', 'systemPrompt', 'model', 'temperature', 'monthlyMessageLimit', 'metaPhoneNumberId', 'metaWabaId', 'metaWebhookVerifyToken'];
    for (const k of allowed) if (data[k] !== undefined) update[k] = data[k];

    // Encrypted secrets: a non-empty value sets it; null OR empty string CLEARS it (rotate-off a
    // leaked credential); '***' is the masked placeholder from the UI and means "leave unchanged".
    if (data.metaAccessToken !== undefined && data.metaAccessToken !== '***') {
      update.metaAccessTokenEnc = data.metaAccessToken ? encrypt(data.metaAccessToken) : null;
    }
    if (data.metaAppSecret !== undefined && data.metaAppSecret !== '***') {
      update.metaAppSecretEnc = data.metaAppSecret ? encrypt(data.metaAppSecret) : null;
    }

    await this.prisma.whatsappAgentConfig.upsert({
      where: { tenantId },
      update,
      create: { tenantId, ...update },
    });
    return this.getConfig(tenantId);
  }

  // ── Webhook verification (GET) ──

  async verifyWebhook(tenantId: string, mode: string, verifyToken: string, challenge: string) {
    const cfg = await this.prisma.whatsappAgentConfig.findUnique({ where: { tenantId } });
    if (mode === 'subscribe' && cfg?.metaWebhookVerifyToken && verifyToken === cfg.metaWebhookVerifyToken) {
      return challenge;
    }
    return null;
  }

  // ── Webhook ingest (POST from Meta) ──

  async ingestWebhook(tenantId: string, body: any, rawBody?: Buffer, signatureHeader?: string) {
    const cfg = await this.prisma.whatsappAgentConfig.findUnique({ where: { tenantId } });
    if (!cfg || !cfg.enabled) return { ok: true, skipped: 'agent_disabled' };

    // ── HMAC signature verification (fail-closed) ──
    // The agent is enabled; an app secret MUST be configured so we can verify
    // X-Hub-Signature-256. If none is configured, reject instead of processing
    // an unsigned (spoofable) webhook.
    if (!cfg.metaAppSecretEnc) {
      this.logger.warn(`[${tenantId}] webhook rejected: no app secret configured (fail-closed)`);
      return { ok: false, error: 'signature_required' };
    }
    if (!rawBody || !signatureHeader) {
      this.logger.warn(`[${tenantId}] webhook rejected: missing signature or raw body`);
      return { ok: false, error: 'signature_required' };
    }
    let appSecret: string;
    try {
      appSecret = decrypt(cfg.metaAppSecretEnc);
    } catch {
      this.logger.error(`[${tenantId}] cannot decrypt app secret`);
      return { ok: false, error: 'app_secret_decrypt_failed' };
    }
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    // Use constant-time comparison
    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      this.logger.warn(`[${tenantId}] webhook rejected: invalid signature`);
      return { ok: false, error: 'invalid_signature' };
    }

    // Meta payload format: { entry: [{ changes: [{ value: { messages: [...] } }] }] }
    const entries = body.entry || [];
    let processed = 0;
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const messages = change.value?.messages || [];
        for (const msg of messages) {
          if (msg.type !== 'text') continue; // for MVP, only text
          const from = msg.from as string; // E.164 without +
          const text = msg.text?.body as string;
          if (!from || !text) continue;
          await this.handleIncomingMessage(tenantId, from, text, msg.id);
          processed++;
        }
      }
    }
    return { ok: true, processed };
  }

  /**
   * Core LLM + tools loop. Returns the agent's text response.
   * Reused by webhook (handleIncomingMessage) and playground (testMessage).
   */
  private async runAgent(args: {
    tenantId: string;
    phoneNumber: string;
    conversationId: string;
    userText: string;
  }): Promise<{ answer: string; toolCallsLog: any[]; error?: string }> {
    const { tenantId, phoneNumber, conversationId, userText } = args;

    const cfg = await this.prisma.whatsappAgentConfig.findUnique({ where: { tenantId } });
    if (!cfg) return { answer: '', toolCallsLog: [], error: 'agent_not_configured' };

    // Strip BOM/zero-width chars that sneak in via PowerShell env exports
    const apiKey = (process.env.DEEPSEEK_API_KEY || '').replace(/[﻿​ ]/g, '').trim();
    if (!apiKey) {
      return {
        answer: '',
        toolCallsLog: [],
        error: 'DEEPSEEK_API_KEY no está configurada en el servidor. El admin debe pegarla en las variables de entorno de Vercel.',
      };
    }

    // Build conversation history (last 20 messages from this conversation)
    const history = await this.prisma.whatsappMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    history.reverse();

    // Resolve linked customer
    const conversation = await this.prisma.whatsappConversation.findUnique({ where: { id: conversationId } });
    const linkedCustomer = conversation?.customerId
      ? await this.prisma.customer.findUnique({ where: { id: conversation.customerId } })
      : null;

    const systemPrompt =
      cfg.systemPrompt +
      `\n\nContexto:\n- Tu nombre: ${cfg.agentName}\n- Número del cliente (E.164): ${phoneNumber}\n` +
      (linkedCustomer
        ? `- Cliente identificado: ${linkedCustomer.name} (customerId: ${linkedCustomer.id})`
        : `- Cliente NO identificado. Usa buscar_cliente_por_telefono al inicio.`) +
      `\n- Idioma: Español (Colombia). Sé breve, máximo 3 frases por respuesta cuando sea posible.`;

    const client = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    ];
    // Add the new user message if not already the last one in history
    if (!history.length || history[history.length - 1].content !== userText) {
      messages.push({ role: 'user', content: userText });
    }

    const toolCallsLog: any[] = [];
    const maxTurns = cfg.maxTurns || 8;
    let finalAnswer = '';

    // Get admin user for tool execution
    const adminUser = await this.prisma.user.findFirst({
      where: { tenantId, role: { in: ['admin', 'platform_superadmin'] } },
      orderBy: { createdAt: 'asc' },
    });
    const userId = adminUser?.id || '';

    for (let turn = 0; turn < maxTurns; turn++) {
      const completion = await client.chat.completions
        .create({
          model: cfg.model || 'deepseek-chat',
          messages,
          tools: TOOL_DEFINITIONS,
          tool_choice: 'auto',
          temperature: cfg.temperature ?? 0.5,
          max_tokens: 800,
        })
        .catch((err) => {
          this.logger.error('DeepSeek error: ' + err.message + ' status=' + err.status + ' code=' + err.code);
          return { __err: err.message, __status: err.status, __code: err.code } as any;
        });

      if (!completion || (completion as any).__err) {
        const errInfo = (completion as any) || {};
        return {
          answer: '',
          toolCallsLog,
          error: `DeepSeek falló: ${errInfo.__err || 'sin detalles'} (status=${errInfo.__status || '?'}, code=${errInfo.__code || '?'}, keyLen=${apiKey?.length || 0})`,
        };
      }

      const msg = completion.choices[0].message;
      messages.push(msg);

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls as any[]) {
          if (!tc?.function?.name) continue;
          const callArgs = JSON.parse(tc.function.arguments || '{}');
          const result = await executeTool(tc.function.name, callArgs, {
            prisma: this.prisma,
            tenantId,
            userId,
            phoneNumber,
            conversationId,
            // Financial autonomy gate (defaults OFF if column/value missing).
            allowAutoInvoice: (cfg as any).allowAutoInvoice === true,
          });
          toolCallsLog.push({ name: tc.function.name, args: callArgs, result });
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }
        continue;
      }

      finalAnswer = msg.content || 'Gracias por tu mensaje.';
      break;
    }

    if (!finalAnswer) finalAnswer = 'Gracias por tu mensaje. ¿Te puedo ayudar con algo más?';
    return { answer: finalAnswer, toolCallsLog };
  }

  private async handleIncomingMessage(tenantId: string, phoneNumber: string, text: string, metaMessageId?: string) {
    // 1. Get or create conversation
    let conversation = await this.prisma.whatsappConversation.findUnique({
      where: { tenantId_phoneNumber: { tenantId, phoneNumber } },
    });
    if (!conversation) {
      conversation = await this.prisma.whatsappConversation.create({
        data: { tenantId, phoneNumber, status: 'active' },
      });
    }

    // 2. Store inbound message
    await this.prisma.whatsappMessage.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        role: 'user',
        content: text,
        metaMessageId,
        status: 'delivered',
      },
    });
    await this.prisma.whatsappConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
    });

    // 3. If human took over, don't auto-respond
    if (conversation.status === 'taken_over_by_human' || conversation.status === 'paused') {
      return;
    }

    // 4. Check monthly limit
    const cfg = await this.prisma.whatsappAgentConfig.findUnique({ where: { tenantId } });
    if (!cfg) return;
    if (cfg.monthlyMessageCount >= cfg.monthlyMessageLimit) {
      this.logger.warn(`Tenant ${tenantId} reached monthly message limit`);
      return;
    }

    // 5. Run agent
    const { answer: finalAnswer, toolCallsLog } = await this.runAgent({
      tenantId,
      phoneNumber,
      conversationId: conversation.id,
      userText: text,
    });
    if (!finalAnswer) return;

    // 10. Send answer back via Meta API
    const sendResult = await this.sendWhatsappMessage(tenantId, phoneNumber, finalAnswer);

    // 11. Store agent message
    await this.prisma.whatsappMessage.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        role: 'agent',
        content: finalAnswer,
        metaMessageId: sendResult.messageId,
        status: sendResult.ok ? 'sent' : 'failed',
        toolCalls: toolCallsLog.length ? (toolCallsLog as any) : undefined,
      },
    });

    await this.prisma.whatsappAgentConfig.update({
      where: { tenantId },
      data: { monthlyMessageCount: { increment: 1 }, updatedAt: new Date() },
    });
  }

  // ── Playground: prueba el agente sin Meta ──

  async testMessage(tenantId: string, userText: string, phoneNumber?: string) {
    // Use a dedicated "playground" conversation per tenant (phone = "PLAYGROUND")
    // so it doesn't mix with real conversations.
    const phone = phoneNumber || 'PLAYGROUND';

    let conversation = await this.prisma.whatsappConversation.findUnique({
      where: { tenantId_phoneNumber: { tenantId, phoneNumber: phone } },
    });
    if (!conversation) {
      conversation = await this.prisma.whatsappConversation.create({
        data: { tenantId, phoneNumber: phone, status: 'active' },
      });
    }

    // Store user message
    await this.prisma.whatsappMessage.create({
      data: { tenantId, conversationId: conversation.id, role: 'user', content: userText, status: 'delivered' },
    });

    // Make sure DEEPSEEK_API_KEY exists; return clear error otherwise
    if (!process.env.DEEPSEEK_API_KEY) {
      return {
        ok: false,
        error: 'DEEPSEEK_API_KEY no está configurada en Vercel. Agrégala con: vercel env add DEEPSEEK_API_KEY production',
        answer: null,
        toolCalls: [],
        conversationId: conversation.id,
      };
    }

    // Make sure agent config exists (even if not enabled — playground doesn't require enabled)
    await this.prisma.whatsappAgentConfig.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });

    const { answer, toolCallsLog, error } = await this.runAgent({
      tenantId,
      phoneNumber: phone,
      conversationId: conversation.id,
      userText,
    });

    if (error) {
      return { ok: false, error, answer: null, toolCalls: toolCallsLog, conversationId: conversation.id };
    }

    // Store agent reply
    await this.prisma.whatsappMessage.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        role: 'agent',
        content: answer,
        status: 'sent',
        toolCalls: toolCallsLog.length ? (toolCallsLog as any) : undefined,
      },
    });

    return { ok: true, answer, toolCalls: toolCallsLog, conversationId: conversation.id };
  }

  async resetPlayground(tenantId: string) {
    const conv = await this.prisma.whatsappConversation.findUnique({
      where: { tenantId_phoneNumber: { tenantId, phoneNumber: 'PLAYGROUND' } },
    });
    if (conv) {
      await this.prisma.whatsappMessage.deleteMany({ where: { conversationId: conv.id } });
      await this.prisma.whatsappConversation.update({
        where: { id: conv.id },
        data: { customerId: null, lastMessageAt: new Date() },
      });
    }
    return { ok: true };
  }

  // ── Send message via Meta WhatsApp Cloud API ──

  async sendWhatsappMessage(tenantId: string, to: string, body: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
    const cfg = await this.prisma.whatsappAgentConfig.findUnique({ where: { tenantId } });
    if (!cfg?.metaPhoneNumberId || !cfg?.metaAccessTokenEnc) {
      return { ok: false, error: 'Meta no configurada' };
    }
    try {
      const token = decrypt(cfg.metaAccessTokenEnc);
      const res = await fetch(`https://graph.facebook.com/v18.0/${cfg.metaPhoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to.replace(/\D/g, ''),
          type: 'text',
          text: { body },
        }),
      });
      const data: any = await res.json();
      if (!res.ok) return { ok: false, error: data.error?.message || `HTTP ${res.status}` };
      return { ok: true, messageId: data.messages?.[0]?.id };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  // ── Admin: conversations CRUD ──

  async listConversations(tenantId: string) {
    return this.prisma.whatsappConversation.findMany({
      where: { tenantId },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, role: true, createdAt: true } },
      },
    });
  }

  async getConversation(tenantId: string, id: string) {
    const conv = await this.prisma.whatsappConversation.findFirst({
      where: { id, tenantId },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 200 },
      },
    });
    if (!conv) return null;
    await this.prisma.whatsappConversation.update({
      where: { id: conv.id },
      data: { unreadCount: 0 },
    });
    return conv;
  }

  async takeOver(tenantId: string, id: string) {
    const conv = await this.prisma.whatsappConversation.findFirst({ where: { id, tenantId } });
    if (!conv) return { ok: false };
    await this.prisma.whatsappConversation.update({
      where: { id }, data: { status: 'taken_over_by_human' },
    });
    return { ok: true };
  }

  async releaseToAgent(tenantId: string, id: string) {
    const conv = await this.prisma.whatsappConversation.findFirst({ where: { id, tenantId } });
    if (!conv) return { ok: false };
    await this.prisma.whatsappConversation.update({
      where: { id }, data: { status: 'active' },
    });
    return { ok: true };
  }

  async sendAsHuman(tenantId: string, conversationId: string, content: string) {
    const conv = await this.prisma.whatsappConversation.findFirst({ where: { id: conversationId, tenantId } });
    if (!conv) return { ok: false, error: 'Conversation not found' };
    const sendResult = await this.sendWhatsappMessage(tenantId, conv.phoneNumber, content);
    await this.prisma.whatsappMessage.create({
      data: {
        tenantId, conversationId: conv.id, role: 'human',
        content, metaMessageId: sendResult.messageId,
        status: sendResult.ok ? 'sent' : 'failed',
      },
    });
    return sendResult;
  }
}
