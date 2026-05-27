import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: jwt.tenant_id },
      include: { customer: true },
    });
    if (!invoice) return Response.json({ message: 'Factura no encontrada' }, { status: 404 });

    const phone = invoice.customer?.phone?.replace(/\D/g, '');
    if (!phone) {
      return Response.json({ message: 'El cliente no tiene número de WhatsApp. Agrega un teléfono para enviar la factura.' }, { status: 400 });
    }

    const formattedPhone = phone.startsWith('57') ? phone : `57${phone}`;
    const total = invoice.total.toLocaleString('es-CO');
    const message = encodeURIComponent(
      `Hola ${invoice.customer.name}, te compartimos tu factura ${invoice.invoiceNumber} por valor de $${total} COP. ¡Gracias por tu compra!`
    );
    const waUrl = `https://wa.me/${formattedPhone}?text=${message}`;

    // Log delivery
    await prisma.invoiceDeliveryLog.create({
      data: {
        tenantId: jwt.tenant_id,
        invoiceId: id,
        channel: 'whatsapp',
        status: 'sent',
        destination: formattedPhone,
        message: decodeURIComponent(message),
      },
    });

    // Central message log
    await prisma.messageLog.create({
      data: {
        tenantId: jwt.tenant_id,
        customerId: invoice.customerId,
        invoiceId: id,
        channel: 'whatsapp',
        destination: formattedPhone,
        message: decodeURIComponent(message),
        status: 'sent',
        provider: 'wa.me',
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: jwt.tenant_id,
        userId: jwt.sub,
        action: 'sent',
        resourceType: 'invoice',
        resourceId: id,
        changes: { channel: 'whatsapp', phone: formattedPhone },
      },
    });

    return Response.json({ waUrl, phone: formattedPhone });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
