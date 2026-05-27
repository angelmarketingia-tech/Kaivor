import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { encrypt, decrypt } from '@/common/crypto.util';

/**
 * DIAN Provider abstraction.
 *
 * In production, this service delegates to a contracted technological provider
 * (DataICO, Carvajal, FacturaTech, Siigo, Alegra, etc.). The contract requires:
 *  - certificate (.p12) issued by an authorized CA
 *  - resolution from DIAN with numbering range
 *  - provider API endpoint + token
 *
 * Until those are configured, the service operates in "stub" mode:
 *  - Stores configuration (encrypted)
 *  - Returns deterministic "sandbox" responses for testing
 *  - Marks invoices with provisional CUDE-like identifiers
 *  - NEVER claims real DIAN acceptance
 */
@Injectable()
export class DianService {
  constructor(private prisma: PrismaService) {}

  async getStatus(tenantId: string) {
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    return {
      enabled: settings?.dianEnabled ?? false,
      environment: this.detectEnvironment(),
      requiresAction: !settings?.dianEnabled,
      message: settings?.dianEnabled
        ? 'DIAN configurada en modo sandbox/stub. La aceptación real requiere proveedor contratado.'
        : 'DIAN no configurada. Configura proveedor en /settings/dian.',
    };
  }

  async submitInvoice(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { customer: true },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');

    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings?.dianEnabled) {
      return {
        ok: false,
        status: 'not_configured',
        message: 'DIAN no está configurada para este tenant. Configura proveedor primero.',
      };
    }

    // STUB: deterministic CUDE-like identifier from invoice
    const cude = `STUB-${invoice.invoiceNumber}-${Date.now().toString(36).toUpperCase()}`;
    const uuid = `STUB-UUID-${invoice.id.slice(0, 12)}`;

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        dianStatus: 'sandbox_accepted',
        dianCude: cude,
        dianUuid: uuid,
        dianSentAt: new Date(),
      },
    });

    return {
      ok: true,
      status: 'sandbox_accepted',
      cude,
      uuid,
      message: 'Sandbox/stub: el envío fue procesado localmente. Para validación DIAN real, contrata un proveedor tecnológico autorizado.',
    };
  }

  async retrieveStatus(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    return {
      dianStatus: invoice.dianStatus || 'pending',
      cude: invoice.dianCude,
      uuid: invoice.dianUuid,
      sentAt: invoice.dianSentAt,
    };
  }

  private detectEnvironment(): 'production' | 'sandbox' | 'not_configured' {
    if (process.env.DIAN_PROVIDER_TOKEN && process.env.DIAN_ENVIRONMENT === 'production') return 'production';
    if (process.env.DIAN_PROVIDER_TOKEN) return 'sandbox';
    return 'not_configured';
  }
}
