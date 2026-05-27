import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaymentAdapter } from '@/lib/payment-adapters';

// Inbound webhook receiver for payment providers.
// Public endpoint — providers call it. It validates, logs, and (when a matching
// payment reference is found) updates the payment status. It NEVER fakes a
// confirmation without a real payload.
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await params;
    let payload: any = {};
    try { payload = await req.json(); } catch { /* may be form-encoded */ }

    // The tenant must be identifiable from the payload (real providers send merchant metadata).
    const tenantId = payload?.tenantId || payload?.metadata?.tenantId || null;
    if (!tenantId) {
      return Response.json({ ok: false, message: 'Webhook recibido sin identificador de empresa.' }, { status: 202 });
    }

    const integration = await prisma.paymentIntegration.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!integration) {
      await prisma.paymentLog.create({
        data: { tenantId, provider, action: 'webhook', status: 'error', message: 'Webhook de proveedor no configurado.' },
      }).catch(() => {});
      return Response.json({ ok: false, message: 'Proveedor no configurado para esta empresa.' }, { status: 202 });
    }

    const adapter = getPaymentAdapter(provider);
    const result = await adapter.handleWebhook(
      {
        provider: integration.provider, status: integration.status, environment: integration.environment,
        merchantId: integration.merchantId, receiverInfo: integration.receiverInfo,
        hasKeys: !!(integration.publicKeyEnc || integration.privateKeyEnc),
      },
      payload,
    );

    await prisma.paymentLog.create({
      data: {
        tenantId, provider, action: 'webhook',
        status: result.ok ? 'ok' : 'error', environment: integration.environment,
        message: result.message, reference: payload?.reference || payload?.transactionId || null,
        metadata: payload,
      },
    }).catch(() => {});

    // If the provider confirmed a payment and we can match it by reference, update it.
    const ref = payload?.reference || payload?.transactionId;
    const confirmedStatus = String(payload?.status || '').toLowerCase();
    if (ref && (confirmedStatus === 'approved' || confirmedStatus === 'paid' || confirmedStatus === 'confirmed')) {
      const payment = await prisma.payment.findFirst({ where: { tenantId, reference: String(ref) } });
      if (payment && payment.status !== 'confirmed') {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: 'confirmed', provider } });
      }
    }

    return Response.json({ ok: true, message: result.message });
  } catch (err: any) {
    return Response.json({ ok: false, message: err.message }, { status: 500 });
  }
}
