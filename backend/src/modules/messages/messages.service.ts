import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { decrypt } from '@/common/crypto.util';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, channel?: string) {
    const where: any = { tenantId };
    if (channel === 'whatsapp' || channel === 'email') where.channel = channel;
    const rows = await this.prisma.message.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
    // Map to the shape the frontend reads: { destination, message, sentAt }
    return rows.map((m) => ({
      id: m.id,
      channel: m.channel,
      destination: m.recipient,
      recipientName: m.recipientName,
      subject: m.subject,
      message: m.body,
      status: m.status,
      sentAt: m.createdAt,
    }));
  }

  // ── Templates ──
  listTemplates(tenantId: string) {
    return this.prisma.messageTemplate.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  createTemplate(tenantId: string, data: any) {
    const name = typeof data?.name === 'string' ? data.name.trim() : '';
    if (!name) throw new BadRequestException('El nombre de la plantilla es requerido');
    const body = data.body ?? data.content;
    if (!body || !String(body).trim()) throw new BadRequestException('El contenido de la plantilla es requerido');
    return this.prisma.messageTemplate.create({
      data: {
        tenantId,
        name,
        channel: data.channel || 'whatsapp',
        subject: data.subject ?? null,
        body,
      },
    });
  }

  async updateTemplate(tenantId: string, id: string, data: any) {
    const t = await this.prisma.messageTemplate.findFirst({ where: { id, tenantId } });
    if (!t) throw new NotFoundException('Plantilla no encontrada');
    const update: any = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.channel !== undefined) update.channel = data.channel;
    if (data.subject !== undefined) update.subject = data.subject;
    const body = data.body ?? data.content;
    if (body !== undefined) update.body = body;
    return this.prisma.messageTemplate.update({ where: { id }, data: update });
  }

  async deleteTemplate(tenantId: string, id: string) {
    const t = await this.prisma.messageTemplate.findFirst({ where: { id, tenantId } });
    if (!t) throw new NotFoundException('Plantilla no encontrada');
    await this.prisma.messageTemplate.delete({ where: { id } });
    return { ok: true };
  }

  // ── Send ──
  async send(tenantId: string, data: any) {
    const channel = data.channel;
    // Accept frontend aliases: destination → recipient, message → body
    const recipient = data.recipient ?? data.destination;
    const recipientName = data.recipientName;
    const subject = data.subject;
    const messageBody = data.body ?? data.message;

    if (channel === 'email') {
      if (!messageBody || !String(messageBody).trim()) {
        return { ok: false, status: 'failed', error: 'El mensaje no puede estar vacío.' };
      }
      return this.sendEmail(tenantId, recipient, subject || 'Mensaje', messageBody);
    }
    if (channel === 'whatsapp') {
      if (!messageBody || !String(messageBody).trim()) {
        return { ok: false, status: 'failed', error: 'El mensaje no puede estar vacío.' };
      }
      return this.sendWhatsApp(tenantId, recipient, recipientName, messageBody);
    }
    return { ok: false, error: 'Canal no soportado' };
  }

  async sendWhatsApp(tenantId: string, phone: string | undefined, name: string | undefined, body: string) {
    const clean = (phone || '').replace(/\D/g, '');
    if (!clean) {
      return { ok: false, status: 'failed', error: 'El cliente no tiene un número de teléfono válido.' };
    }
    const text = body || '';
    const waUrl = `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });

    if (!settings?.whatsappEnabled || !settings?.whatsappTokenEncrypted) {
      // wa.me flow — frontend opens waUrl
      await this.log(tenantId, { channel: 'whatsapp', recipient: clean, recipientName: name, body: text, status: 'sent', provider: 'wa.me' });
      return { ok: true, status: 'sent', waUrl };
    }

    // Meta Cloud API
    try {
      const token = decrypt(settings.whatsappTokenEncrypted);
      const phoneNumberId = settings.whatsappPhone;
      const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: clean, type: 'text', text: { body: text } }),
      });
      const result: any = await res.json();
      if (!res.ok) {
        await this.log(tenantId, { channel: 'whatsapp', recipient: clean, body: text, status: 'failed', provider: 'meta', error: result.error?.message });
        return { ok: false, status: 'failed', error: result.error?.message };
      }
      await this.log(tenantId, { channel: 'whatsapp', recipient: clean, recipientName: name, body: text, status: 'sent', provider: 'meta', providerRef: result.messages?.[0]?.id });
      return { ok: true, status: 'sent', waUrl };
    } catch (e: any) {
      await this.log(tenantId, { channel: 'whatsapp', recipient: clean, body: text, status: 'failed', provider: 'meta', error: e.message });
      return { ok: false, status: 'failed', error: e.message };
    }
  }

  async sendEmail(tenantId: string, to: string, subject: string, body: string) {
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings?.emailEnabled || !settings?.emailHost || !settings?.emailUser || !settings?.emailPassEncrypted) {
      await this.log(tenantId, { channel: 'email', recipient: to, subject, body, status: 'failed', error: 'not_configured' });
      return { ok: false, status: 'failed', error: 'Email no configurado' };
    }
    try {
      const pass = decrypt(settings.emailPassEncrypted);
      const transporter = nodemailer.createTransport({
        host: settings.emailHost,
        port: settings.emailPort || 587,
        secure: (settings.emailPort || 587) === 465,
        auth: { user: settings.emailUser, pass },
      });
      const info = await transporter.sendMail({
        from: settings.emailFrom || settings.emailUser,
        to, subject, html: body, text: body,
      });
      await this.log(tenantId, { channel: 'email', recipient: to, subject, body, status: 'sent', provider: 'smtp', providerRef: info.messageId });
      return { ok: true, status: 'sent', messageId: info.messageId };
    } catch (e: any) {
      await this.log(tenantId, { channel: 'email', recipient: to, subject, body, status: 'failed', provider: 'smtp', error: e.message });
      return { ok: false, status: 'failed', error: e.message };
    }
  }

  async testEmail(tenantId: string, to: string) {
    const target = to || (await this.prisma.tenantSettings.findUnique({ where: { tenantId } }))?.emailFrom;
    if (!target) return { ok: false, error: 'Configura el correo remitente primero' };
    return this.sendEmail(tenantId, target, 'Prueba de conexión SMTP — Kaivor', '<p>Si recibes este correo, tu SMTP funciona correctamente.</p>');
  }

  private log(tenantId: string, data: any) {
    return this.prisma.message.create({ data: { tenantId, ...data } }).catch(() => null);
  }
}
