import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { decrypt } from '@/common/crypto.util';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.message.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  // ── Templates ──
  listTemplates(tenantId: string) {
    return this.prisma.messageTemplate.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  createTemplate(tenantId: string, data: any) {
    return this.prisma.messageTemplate.create({
      data: { tenantId, name: data.name, channel: data.channel || 'whatsapp', body: data.body },
    });
  }

  async updateTemplate(tenantId: string, id: string, data: any) {
    const t = await this.prisma.messageTemplate.findFirst({ where: { id, tenantId } });
    if (!t) return null;
    return this.prisma.messageTemplate.update({ where: { id }, data: { name: data.name, body: data.body, channel: data.channel } });
  }

  async deleteTemplate(tenantId: string, id: string) {
    const t = await this.prisma.messageTemplate.findFirst({ where: { id, tenantId } });
    if (!t) return { ok: false };
    await this.prisma.messageTemplate.delete({ where: { id } });
    return { ok: true };
  }

  // ── Send ──
  async send(tenantId: string, data: any) {
    const { channel, recipient, recipientName, subject, body } = data;
    if (channel === 'email') return this.sendEmail(tenantId, recipient, subject || 'Mensaje', body);
    if (channel === 'whatsapp') return this.sendWhatsApp(tenantId, recipient, recipientName, body);
    return { ok: false, error: 'Canal no soportado' };
  }

  async sendWhatsApp(tenantId: string, phone: string, name: string | undefined, body: string) {
    if (!phone) return { ok: false, status: 'failed', error: 'Sin número' };
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    const clean = phone.replace(/\D/g, '');

    if (!settings?.whatsappEnabled || !settings?.whatsappTokenEncrypted) {
      // wa.me fallback
      const link = `https://wa.me/${clean}?text=${encodeURIComponent(body)}`;
      await this.log(tenantId, { channel: 'whatsapp', recipient: clean, recipientName: name, body, status: 'manual_opened', provider: 'wa.me' });
      return { ok: true, status: 'manual_opened', fallbackLink: link };
    }

    // Meta Cloud API
    try {
      const token = decrypt(settings.whatsappTokenEncrypted);
      const phoneNumberId = settings.whatsappPhone;
      const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: clean, type: 'text', text: { body } }),
      });
      const result: any = await res.json();
      if (!res.ok) {
        await this.log(tenantId, { channel: 'whatsapp', recipient: clean, body, status: 'failed', provider: 'meta', error: result.error?.message });
        return { ok: false, status: 'failed', error: result.error?.message };
      }
      await this.log(tenantId, { channel: 'whatsapp', recipient: clean, recipientName: name, body, status: 'sent', provider: 'meta', providerRef: result.messages?.[0]?.id });
      return { ok: true, status: 'sent' };
    } catch (e: any) {
      await this.log(tenantId, { channel: 'whatsapp', recipient: clean, body, status: 'failed', provider: 'meta', error: e.message });
      return { ok: false, status: 'failed', error: e.message };
    }
  }

  async sendEmail(tenantId: string, to: string, subject: string, body: string) {
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings?.emailEnabled || !settings?.emailHost || !settings?.emailUser || !settings?.emailPassEncrypted) {
      await this.log(tenantId, { channel: 'email', recipient: to, subject, status: 'failed', error: 'not_configured' });
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
      await this.log(tenantId, { channel: 'email', recipient: to, subject, status: 'failed', provider: 'smtp', error: e.message });
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
