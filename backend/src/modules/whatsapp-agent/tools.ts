import { PrismaService } from '@/prisma/prisma.service';

/**
 * Tool definitions (OpenAI-compatible JSON schema) + executor.
 * Each tool runs scoped to a single tenant.
 */

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'buscar_cliente_por_telefono',
      description: 'Encuentra el cliente vinculado al número de WhatsApp que está hablando. Úsalo siempre al inicio para identificarlo.',
      parameters: {
        type: 'object',
        properties: { phone: { type: 'string', description: 'Número en E.164 sin +' } },
        required: ['phone'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'listar_productos',
      description: 'Lista productos del catálogo del negocio. Opcionalmente filtra por nombre o categoría.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Texto a buscar en nombre/SKU/categoría' },
          limit: { type: 'integer', default: 10 },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'consultar_inventario',
      description: 'Consulta el stock disponible de un producto específico por SKU o nombre.',
      parameters: {
        type: 'object',
        properties: { producto: { type: 'string' } },
        required: ['producto'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'buscar_facturas_cliente',
      description: 'Devuelve facturas del cliente identificado. Útil para "¿cuánto debo?" o "mi última factura".',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          soloPendientes: { type: 'boolean', default: false },
          limit: { type: 'integer', default: 5 },
        },
        required: ['customerId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'crear_factura',
      description: 'Crea una factura para el cliente identificado con una lista de items.',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string', description: 'Opcional: ID del producto del catálogo' },
                description: { type: 'string' },
                quantity: { type: 'number' },
                unitPrice: { type: 'number' },
                taxRate: { type: 'number', default: 19 },
              },
              required: ['description', 'quantity', 'unitPrice'],
            },
          },
          paymentMethod: { type: 'string', enum: ['cash', 'card', 'transfer', 'nequi', 'daviplata', 'credit'] },
          notes: { type: 'string' },
        },
        required: ['customerId', 'items'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'resumen_negocio',
      description: 'Cuando el cliente pregunta cosas como horarios, dirección, qué vendemos o información general.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'escalar_a_humano',
      description: 'Úsala cuando no puedas resolver la consulta o el cliente pide hablar con una persona. Marca la conversación para que un humano la atienda.',
      parameters: {
        type: 'object',
        properties: { motivo: { type: 'string' } },
        required: ['motivo'],
      },
    },
  },
];

const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

export async function executeTool(
  name: string,
  args: any,
  ctx: { prisma: PrismaService; tenantId: string; userId: string; phoneNumber: string; conversationId: string },
): Promise<string> {
  const { prisma, tenantId, userId, phoneNumber, conversationId } = ctx;

  try {
    switch (name) {
      case 'buscar_cliente_por_telefono': {
        const phone = (args.phone || phoneNumber).replace(/\D/g, '');
        const variants = [phone, '+' + phone, phone.slice(-10)];
        const customer = await prisma.customer.findFirst({
          where: {
            tenantId,
            OR: variants.map((v) => ({ phone: { contains: v } })),
          },
        });
        if (!customer) return JSON.stringify({ encontrado: false, mensaje: 'No hay cliente con ese teléfono. Pídele su nombre y NIT para registrarlo.' });
        // Link conversation to customer
        await prisma.whatsappConversation.update({
          where: { id: conversationId },
          data: { customerId: customer.id },
        }).catch(() => null);
        return JSON.stringify({
          encontrado: true,
          customerId: customer.id,
          nombre: customer.name,
          email: customer.email,
        });
      }

      case 'listar_productos': {
        const where: any = { tenantId, isActive: true };
        if (args.query) {
          where.OR = [
            { name: { contains: args.query, mode: 'insensitive' } },
            { sku: { contains: args.query, mode: 'insensitive' } },
            { category: { contains: args.query, mode: 'insensitive' } },
          ];
        }
        const products = await prisma.product.findMany({
          where,
          take: Math.min(args.limit || 10, 25),
          select: { id: true, sku: true, name: true, price: true, category: true },
        });
        return JSON.stringify({
          total: products.length,
          productos: products.map((p) => ({
            id: p.id, sku: p.sku, nombre: p.name, categoria: p.category, precio: fmtCOP(p.price),
          })),
        });
      }

      case 'consultar_inventario': {
        const product = await prisma.product.findFirst({
          where: {
            tenantId,
            OR: [
              { sku: { equals: args.producto, mode: 'insensitive' } },
              { name: { contains: args.producto, mode: 'insensitive' } },
            ],
          },
        });
        if (!product) return JSON.stringify({ encontrado: false });
        const inv = await prisma.inventory.findMany({ where: { tenantId, productId: product.id } });
        const total = inv.reduce((s, i) => s + Number(i.quantity), 0);
        return JSON.stringify({
          encontrado: true,
          producto: product.name,
          precio: fmtCOP(product.price),
          stock_total: total,
          almacenes: inv.map((i) => ({ warehouse: i.warehouse, cantidad: Number(i.quantity) })),
        });
      }

      case 'buscar_facturas_cliente': {
        const where: any = { tenantId, customerId: args.customerId };
        if (args.soloPendientes) where.status = { in: ['draft', 'sent', 'rejected'] };
        const invoices = await prisma.invoice.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Math.min(args.limit || 5, 20),
          select: { id: true, invoiceNumber: true, total: true, status: true, invoiceDate: true, dueDate: true },
        });
        return JSON.stringify({
          total: invoices.length,
          facturas: invoices.map((i) => ({
            id: i.id, numero: i.invoiceNumber, total: fmtCOP(i.total),
            estado: i.status, fecha: i.invoiceDate,
          })),
        });
      }

      case 'crear_factura': {
        if (!args.customerId || !args.items?.length) {
          return JSON.stringify({ ok: false, error: 'Faltan customerId o items' });
        }
        const company = await prisma.company.findFirst({ where: { tenantId } });
        if (!company) return JSON.stringify({ ok: false, error: 'No hay empresa configurada' });

        // Calculate totals
        let subtotal = 0, taxAmount = 0, total = 0;
        const normItems = args.items.map((it: any) => {
          const qty = parseFloat(it.quantity) || 0;
          const unit = parseFloat(it.unitPrice) || 0;
          const gross = qty * unit;
          const tax = (gross * (parseFloat(it.taxRate) || 0)) / 100;
          subtotal += gross; taxAmount += tax; total += gross + tax;
          return { ...it, qty, unit, lineTotal: gross + tax };
        });

        const count = await prisma.invoice.count({ where: { tenantId } });
        const invoiceNumber = `FE-${String(count + 1).padStart(6, '0')}`;

        const invoice = await prisma.$transaction(async (tx) => {
          const transaction = await tx.transaction.create({
            data: {
              tenantId, companyId: company.id, userId,
              customerId: args.customerId, type: 'sale',
              total, taxAmount, status: 'completed',
              items: {
                create: normItems
                  .filter((i: any) => i.productId)
                  .map((i: any) => ({
                    tenantId, productId: i.productId, quantity: i.qty,
                    unitPrice: i.unit, taxPercent: parseFloat(i.taxRate) || 0,
                    lineTotal: i.lineTotal,
                  })),
              },
            },
          });
          const inv = await tx.invoice.create({
            data: {
              tenantId, companyId: company.id, customerId: args.customerId,
              transactionId: transaction.id, userId,
              invoiceNumber, invoiceDate: new Date(),
              status: 'sent', subtotal, taxAmount, total,
              notes: args.notes || `Generada por agente WhatsApp (${phoneNumber})`,
            },
          });
          if (args.paymentMethod) {
            await tx.payment.create({
              data: {
                tenantId, invoiceId: inv.id, amount: total,
                method: args.paymentMethod, paidAt: new Date(),
              },
            });
          }
          return inv;
        });

        return JSON.stringify({
          ok: true, numero: invoice.invoiceNumber,
          total: fmtCOP(invoice.total),
          id: invoice.id,
          mensaje: `Factura ${invoice.invoiceNumber} creada por ${fmtCOP(invoice.total)}.`,
        });
      }

      case 'resumen_negocio': {
        const [company, settings] = await Promise.all([
          prisma.company.findFirst({ where: { tenantId } }),
          prisma.tenantSettings.findUnique({ where: { tenantId } }),
        ]);
        return JSON.stringify({
          nombre: company?.name,
          nit: company?.taxId,
          direccion: company?.address,
          telefono: company?.phone,
          email: company?.email,
          notas_recibo: settings?.receiptFooter,
        });
      }

      case 'escalar_a_humano': {
        await prisma.whatsappConversation.update({
          where: { id: conversationId },
          data: { status: 'taken_over_by_human', unreadCount: { increment: 1 } },
        });
        return JSON.stringify({ ok: true, mensaje: 'Conversación escalada a humano. Un asesor responderá pronto.' });
      }

      default:
        return JSON.stringify({ error: `Herramienta no encontrada: ${name}` });
    }
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}
