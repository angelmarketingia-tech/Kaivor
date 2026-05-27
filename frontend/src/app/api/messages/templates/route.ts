import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

const DEFAULT_TEMPLATES = [
  { channel: 'whatsapp', name: 'Envío de factura', subject: null, body: 'Hola {cliente}, te compartimos tu factura {numeroFactura} por valor de {total}. Puedes verla aquí: {linkFactura}. ¡Gracias por tu compra!' },
  { channel: 'whatsapp', name: 'Recordatorio de factura vencida', subject: null, body: 'Hola {cliente}, te recordamos que tu factura {numeroFactura} por {total} está pendiente de pago. Agradecemos tu pronto pago.' },
  { channel: 'whatsapp', name: 'Seguimiento comercial', subject: null, body: 'Hola {cliente}, ¿cómo te ha ido con tu última compra? Estamos atentos para ayudarte con lo que necesites.' },
  { channel: 'whatsapp', name: 'Confirmación de pedido', subject: null, body: 'Hola {cliente}, confirmamos la recepción de tu pedido. Te avisaremos cuando esté listo. ¡Gracias!' },
  { channel: 'whatsapp', name: 'Mensaje de recompra', subject: null, body: 'Hola {cliente}, ha pasado un tiempo desde tu última compra. Tenemos novedades que te pueden interesar. ¡Escríbenos!' },
  { channel: 'email', name: 'Envío de factura por email', subject: 'Tu factura {numeroFactura}', body: 'Estimado/a {cliente},\n\nAdjuntamos tu factura {numeroFactura} por valor de {total}.\n\nGracias por tu compra.' },
  { channel: 'email', name: 'Recordatorio de pago', subject: 'Recordatorio: factura {numeroFactura} pendiente', body: 'Estimado/a {cliente},\n\nTe recordamos que la factura {numeroFactura} por {total} se encuentra pendiente de pago.\n\nQuedamos atentos.' },
];

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    let templates = await prisma.messageTemplate.findMany({
      where: { tenantId: jwt.tenant_id },
      orderBy: { createdAt: 'asc' },
    });
    // Seed defaults on first access
    if (templates.length === 0) {
      for (const t of DEFAULT_TEMPLATES) {
        await prisma.messageTemplate.create({ data: { tenantId: jwt.tenant_id, ...t } });
      }
      templates = await prisma.messageTemplate.findMany({
        where: { tenantId: jwt.tenant_id },
        orderBy: { createdAt: 'asc' },
      });
    }
    return Response.json(templates);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { channel, name, subject, body } = await req.json();
    if (!channel || !name || !body) {
      return Response.json({ message: 'Canal, nombre y cuerpo son requeridos' }, { status: 400 });
    }
    const template = await prisma.messageTemplate.create({
      data: { tenantId: jwt.tenant_id, channel, name, subject: subject || null, body },
    });
    return Response.json(template, { status: 201 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
