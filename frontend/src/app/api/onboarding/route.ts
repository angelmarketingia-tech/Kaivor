import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const tid = jwt.tenant_id;
    const [company, branding, settings, custCount, invCount, prodCount, invTracked, autoCount] = [
      await prisma.company.findFirst({ where: { tenantId: tid } }),
      await prisma.companyBranding.findUnique({ where: { tenantId: tid } }),
      await prisma.tenantSettings.findUnique({ where: { tenantId: tid } }),
      await prisma.customer.count({ where: { tenantId: tid } }),
      await prisma.invoice.count({ where: { tenantId: tid } }),
      await prisma.product.count({ where: { tenantId: tid } }),
      await prisma.inventory.count({ where: { tenantId: tid } }),
      await prisma.automation.count({ where: { tenantId: tid } }),
    ];

    const steps = [
      { id: 'company', label: 'Configura los datos de tu empresa', href: '/settings/company',
        done: !!(company?.taxId && !company.taxId.startsWith('TEMP-')) },
      { id: 'logo', label: 'Sube el logo de tu empresa', href: '/settings/billing/templates',
        done: !!branding?.logoData },
      { id: 'customers', label: 'Agrega o importa tus clientes', href: '/imports',
        done: custCount > 0 },
      { id: 'products', label: 'Agrega o importa tus productos', href: '/imports',
        done: prodCount > 0 },
      { id: 'invoice', label: 'Crea tu primera factura', href: '/invoices/create',
        done: invCount > 0 },
      { id: 'whatsapp', label: 'Configura WhatsApp para enviar facturas', href: '/settings/whatsapp',
        done: !!settings?.waBusinessPhone },
      { id: 'email', label: 'Configura tu correo para enviar por email', href: '/settings/email',
        done: !!settings?.smtpHost },
      { id: 'inventory', label: 'Activa el seguimiento de inventario', href: '/inventory',
        done: invTracked > 0 },
      { id: 'automation', label: 'Crea tu primera automatización', href: '/automations',
        done: autoCount > 0 },
    ];

    const completed = steps.filter(s => s.done).length;
    return Response.json({
      steps, completed, total: steps.length,
      percentage: Math.round((completed / steps.length) * 100),
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
