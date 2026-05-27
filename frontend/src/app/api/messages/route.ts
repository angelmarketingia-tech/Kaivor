import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { getSmtpConfig, sendEmail } from '@/lib/email';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { searchParams } = new URL(req.url);
    const channel = searchParams.get('channel');
    const where: any = { tenantId: jwt.tenant_id };
    if (channel && channel !== 'all') where.channel = channel;
    const logs = await prisma.messageLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
    return Response.json(logs);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { channel, customerId, invoiceId, destination, subject, message } = await req.json();
    if (!channel || !destination || !message) {
      return Response.json({ message: 'Canal, destino y mensaje son requeridos' }, { status: 400 });
    }

    if (channel === 'whatsapp') {
      const phone = String(destination).replace(/\D/g, '');
      if (!phone) return Response.json({ message: 'Número de teléfono inválido' }, { status: 400 });
      const formatted = phone.startsWith('57') || phone.length > 10 ? phone : `57${phone}`;
      const waUrl = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
      const log = await prisma.messageLog.create({
        data: {
          tenantId: jwt.tenant_id, customerId: customerId || null, invoiceId: invoiceId || null,
          channel: 'whatsapp', destination: formatted, message, status: 'sent', provider: 'wa.me',
        },
      });
      return Response.json({ ...log, waUrl });
    }

    if (channel === 'email') {
      const cfg = await getSmtpConfig(jwt.tenant_id);
      if (!cfg) {
        return Response.json({ message: 'Configura tu correo para enviar emails desde Kaivor.', needsConfig: true }, { status: 400 });
      }
      const html = `<div style="font-family:Arial,sans-serif;padding:24px;color:#1e293b;white-space:pre-wrap">${message}</div>`;
      try {
        await sendEmail(cfg, destination, subject || 'Mensaje de Kaivor', html);
        const log = await prisma.messageLog.create({
          data: {
            tenantId: jwt.tenant_id, customerId: customerId || null, invoiceId: invoiceId || null,
            channel: 'email', destination, subject: subject || null, message, status: 'sent', provider: 'smtp',
          },
        });
        return Response.json(log);
      } catch (sendErr: any) {
        const log = await prisma.messageLog.create({
          data: {
            tenantId: jwt.tenant_id, customerId: customerId || null, invoiceId: invoiceId || null,
            channel: 'email', destination, subject: subject || null, message, status: 'failed',
            provider: 'smtp', error: sendErr.message,
          },
        });
        return Response.json({ ...log, message: `Error al enviar: ${sendErr.message}` }, { status: 500 });
      }
    }

    return Response.json({ message: 'Canal no soportado' }, { status: 400 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
