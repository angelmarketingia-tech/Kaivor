import { Injectable, Logger } from '@nestjs/common';
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
    };
  }

  async updateConfig(tenantId: string, data: any) {
    const update: any = {};
    const allowed = ['enabled', 'agentName', 'systemPrompt', 'model', 'temperature', 'monthlyMessageLimit', 'metaPhoneNumberId', 'metaWabaId', 'metaWebhookVerifyToken'];
    for (const k of allowed) if (data[k] !== undefined) update[k] = data[k];
    if (data.metaAccessToken && data.metaAccessToken !== '***') update.metaAccessTokenEnc = encrypt(data.metaAccessToken);
    if (data.metaAppSecret && data.metaAppSecret !== '***') update.metaAppSecretEnc = encrypt(data.metaAppSecret);

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

  async ingestWebhook(tenantId: string, body: any) {
    const cfg = await this.prisma.whatsappAgentConfig.findUnique({ where: { tenantId } });
    if (!cfg || !cfg.enabled) return { ok: true, skipped: 'agent_disabled' };

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

    // 5. Get DeepSeek API key
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      this.logger.error('DEEPSEEK_API_KEY not configured');
      return;
    }

    // 6. Build conversation history (last 20 messages)
    const history = await this.prisma.whatsappMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    history.reverse();

    // 7. Resolve linked customer
    const linkedCustomer = conversation.customerId
      ? await this.prisma.customer.findUnique({ where: { id: conversation.customerId } })
      : null;

    // 8. Build system prompt with context
    const systemPrompt =
      cfg.systemPrompt +
      `\n\nContexto:\n- Tu nombre: ${cfg.agentName}\n- Número del cliente (E.164): ${phoneNumber}\n` +
      (linkedCustomer
        ? `- Cliente identificado: ${linkedCustomer.name} (customerId: ${linkedCustomer.id})`
        : `- Cliente NO identificado. Usa buscar_cliente_por_telefono al inicio.`) +
      `\n- Idioma: Español (Colombia). Sé breve, máximo 3 frases por respuesta cuando sea posible.`;

    // 9. Call DeepSeek with tool calling
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1',
    });

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    ];

    let toolCallsLog: any[] = [];
    const maxTurns = cfg.maxTurns || 8;
    let finalAnswer = '';

    for (let turn = 0; turn < maxTurns; turn++) {
      const completion = await client.chat.completions.create({
        model: cfg.model || 'deepseek-chat',
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        temperature: cfg.temperature ?? 0.5,
        max_tokens: 800,
      }).catch((err) => {
        this.logger.error('DeepSeek error: ' + err.message);
        return null;
      });

      if (!completion) {
        finalAnswer = 'Disculpa, tuve un problema técnico. ¿Puedes repetir tu mensaje?';
        break;
      }

      const msg = completion.choices[0].message;
      messages.push(msg);

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Get superadmin user ID for tool execution (system actions)
        const adminUser = await this.prisma.user.findFirst({
          where: { tenantId, role: { in: ['admin', 'platform_superadmin'] } },
          orderBy: { createdAt: 'asc' },
        });
        const userId = adminUser?.id || '';

        for (const tc of msg.tool_calls as any[]) {
          // Type narrow: only function tool calls (skip custom)
          if (!tc?.function?.name) continue;
          const args = JSON.parse(tc.function.arguments || '{}');
          const result = await executeTool(tc.function.name, args, {
            prisma: this.prisma,
            tenantId,
            userId,
            phoneNumber,
            conversationId: conversation.id,
          });
          toolCallsLog.push({ name: tc.function.name, args, result });
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result,
          });
        }
        continue;
      }

      finalAnswer = msg.content || 'Gracias por tu mensaje.';
      break;
    }

    if (!finalAnswer) finalAnswer = 'Gracias por tu mensaje. ¿Te puedo ayudar con algo más?';

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
