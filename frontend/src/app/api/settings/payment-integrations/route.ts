import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';
import { getPaymentAdapter, PaymentConfig } from '@/lib/payment-adapters';

const PROVIDERS = ['nequi', 'daviplata', 'cards', 'qr', 'addi', 'bank_transfer', 'other'];

function toConfig(row: any): PaymentConfig {
  return {
    provider: row.provider, status: row.status, environment: row.environment,
    merchantId: row.merchantId, receiverInfo: row.receiverInfo,
    hasKeys: !!(row.publicKeyEnc || row.privateKeyEnc),
  };
}

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { searchParams } = new URL(req.url);
    // ?logs=<provider> → return the payment logs for a provider
    const logsProvider = searchParams.get('logs');
    if (logsProvider) {
      const logs = await prisma.paymentLog.findMany({
        where: { tenantId: jwt.tenant_id, provider: logsProvider },
        orderBy: { createdAt: 'desc' }, take: 50,
      });
      return Response.json({ logs });
    }

    const rows = await prisma.paymentIntegration.findMany({ where: { tenantId: jwt.tenant_id } });
    const byProvider: Record<string, any> = {};
    for (const r of rows) {
      byProvider[r.provider] = {
        provider: r.provider, status: r.status, environment: r.environment,
        merchantId: r.merchantId, apiBaseUrl: r.apiBaseUrl, receiverInfo: r.receiverInfo,
        hasKeys: !!(r.publicKeyEnc || r.privateKeyEnc),
        lastTestAt: r.lastTestAt, lastError: r.lastError, updatedAt: r.updatedAt,
      };
    }
    return Response.json({
      providers: PROVIDERS.map(p => byProvider[p] ?? {
        provider: p, status: 'inactive', environment: 'sandbox', hasKeys: false, lastTestAt: null, lastError: null,
      }),
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

// PATCH: configure a provider.
export async function PATCH(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const b = await req.json();
    if (!PROVIDERS.includes(b.provider)) {
      return Response.json({ message: 'Proveedor no válido' }, { status: 400 });
    }
    const data: Record<string, any> = {};
    if ('status' in b) data.status = b.status;
    if ('environment' in b) data.environment = b.environment === 'production' ? 'production' : 'sandbox';
    if ('merchantId' in b) data.merchantId = b.merchantId || null;
    if ('apiBaseUrl' in b) data.apiBaseUrl = b.apiBaseUrl || null;
    if ('receiverInfo' in b) data.receiverInfo = b.receiverInfo || null;
    if (b.publicKey) data.publicKeyEnc = encrypt(String(b.publicKey));
    if (b.privateKey) data.privateKeyEnc = encrypt(String(b.privateKey));

    const row = await prisma.paymentIntegration.upsert({
      where: { tenantId_provider: { tenantId: jwt.tenant_id, provider: b.provider } },
      create: { tenantId: jwt.tenant_id, provider: b.provider, ...data },
      update: data,
    });
    return Response.json({
      provider: row.provider, status: row.status, environment: row.environment,
      merchantId: row.merchantId, receiverInfo: row.receiverInfo, hasKeys: !!(row.publicKeyEnc || row.privateKeyEnc),
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

// POST: test connection through the provider adapter.
export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { provider } = await req.json();
    const row = await prisma.paymentIntegration.findUnique({
      where: { tenantId_provider: { tenantId: jwt.tenant_id, provider } },
    });
    if (!row) {
      await prisma.paymentLog.create({
        data: { tenantId: jwt.tenant_id, provider, action: 'test', status: 'error', message: 'Proveedor no configurado.' },
      });
      return Response.json({ ok: false, message: 'Este proveedor aún no está configurado.' }, { status: 400 });
    }

    const adapter = getPaymentAdapter(provider);
    const result = await adapter.testConnection(toConfig(row));

    await prisma.paymentLog.create({
      data: {
        tenantId: jwt.tenant_id, provider, action: 'test',
        status: result.ok ? 'ok' : 'error', environment: row.environment, message: result.message,
      },
    });
    await prisma.paymentIntegration.update({
      where: { id: row.id },
      data: { lastTestAt: new Date(), lastError: result.ok ? null : result.message },
    });

    return Response.json({ ok: result.ok, message: result.message, environment: row.environment });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
