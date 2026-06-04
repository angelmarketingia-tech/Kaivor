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
      description: 'Devuelve facturas del cliente identificado en esta conversación. Útil para "¿cuánto debo?" o "mi última factura". La identidad se toma de la conversación; no se acepta un customerId arbitrario.',
      parameters: {
        type: 'object',
        properties: {
          soloPendientes: { type: 'boolean', default: false },
          limit: { type: 'integer', default: 5 },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'crear_factura',
      description: 'Crea un BORRADOR de factura para el cliente identificado en esta conversación. NO cobra ni registra pagos: un humano debe confirmarla en el panel. La identidad se toma de la conversación; no se acepta un customerId arbitrario. Cuando uses productId, el precio e impuesto se toman del catálogo (no los inventes).',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string', description: 'Recomendado: ID del producto del catálogo (el precio e impuesto se cargan de la base de datos)' },
                description: { type: 'string' },
                quantity: { type: 'number' },
                unitPrice: { type: 'number', description: 'Solo se usa para items sin productId' },
                taxRate: { type: 'number', default: 19, description: 'Solo se usa para items sin productId' },
              },
              required: ['description', 'quantity'],
            },
          },
          notes: { type: 'string' },
        },
        required: ['items'],
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
  ctx: {
    prisma: PrismaService;
    tenantId: string;
    userId: string;
    phoneNumber: string;
    conversationId: string;
    allowAutoInvoice?: boolean;
  },
): Promise<string> {
  const { prisma, tenantId, userId, phoneNumber, conversationId } = ctx;

  // Identity binding: financial/customer-scoped tools must operate ONLY on the customer
  // resolved for THIS conversation — never on an LLM-supplied customerId (IDOR prevention).
  // We re-read the conversation each time because buscar_cliente_por_telefono may have
  // linked the customer earlier in the same agent loop.
  const resolveBoundCustomerId = async (): Promise<string | null> => {
    const conv = await prisma.whatsappConversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { customerId: true },
    });
    return conv?.customerId ?? null;
  };

  try {
    switch (name) {
      case 'buscar_cliente_por_telefono': {
        // Always identify by the conversation's real phone number, never an LLM-supplied one.
        const rawPhone = phoneNumber || '';
        // Never identify the playground sandbox as a real customer.
        if (!rawPhone || rawPhone.toUpperCase() === 'PLAYGROUND') {
          return JSON.stringify({ encontrado: false, mensaje: 'Cliente no identificado. Pídele su nombre y NIT para registrarlo.' });
        }
        const last10 = rawPhone.replace(/\D/g, '').slice(-10);
        if (last10.length < 10) {
          return JSON.stringify({ encontrado: false, mensaje: 'Cliente no identificado. Pídele su nombre y NIT para registrarlo.' });
        }
        // Pull candidates whose phone ends in the same last-10 digits, then match exactly
        // on normalized last-10 to require a UNIQUE customer (avoid loose `contains` IDOR).
        const candidates = await prisma.customer.findMany({
          where: { tenantId, phone: { contains: last10 } },
          select: { id: true, name: true, email: true, phone: true },
        });
        const matches = candidates.filter(
          (c) => (c.phone || '').replace(/\D/g, '').slice(-10) === last10,
        );
        if (matches.length !== 1) {
          // 0 matches => unknown; >1 => ambiguous. Either way, do not bind an identity.
          return JSON.stringify({ encontrado: false, mensaje: 'Cliente no identificado. Pídele su nombre y NIT para registrarlo.' });
        }
        const customer = matches[0];
        // Link conversation to customer (binds identity for subsequent tool calls)
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
        // Bind to the conversation-resolved customer; IGNORE any LLM-supplied customerId (IDOR).
        const boundCustomerId = await resolveBoundCustomerId();
        if (!boundCustomerId) {
          return JSON.stringify({ ok: false, error: 'cliente_no_identificado', mensaje: 'Cliente no identificado. Usa buscar_cliente_por_telefono primero.' });
        }
        const where: any = { tenantId, customerId: boundCustomerId };
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
        // [P0] Financial autonomy gate. Default OFF: the agent must NOT create invoices/payments
        // autonomously from chat. A human confirms in the dashboard.
        if (ctx.allowAutoInvoice !== true) {
          return JSON.stringify({
            ok: false,
            error: 'auto_invoice_disabled',
            mensaje: 'No puedo emitir facturas desde el chat. He registrado la solicitud; un asesor la confirmará y emitirá desde el panel.',
          });
        }

        // [P1] Bind to the conversation-resolved customer; IGNORE any LLM-supplied customerId.
        const boundCustomerId = await resolveBoundCustomerId();
        if (!boundCustomerId) {
          return JSON.stringify({ ok: false, error: 'cliente_no_identificado', mensaje: 'Cliente no identificado. Usa buscar_cliente_por_telefono primero.' });
        }

        if (!args.items?.length) {
          return JSON.stringify({ ok: false, error: 'Faltan items' });
        }
        const company = await prisma.company.findFirst({ where: { tenantId } });
        if (!company) return JSON.stringify({ ok: false, error: 'No hay empresa configurada' });

        // Build normalized line items. For catalog items (productId) the price and tax are
        // loaded from the DB Product — the LLM-supplied unitPrice/taxRate are ignored. [P1]
        let subtotal = 0, taxAmount = 0, total = 0;
        const normItems: any[] = [];
        for (const it of args.items) {
          const qty = parseFloat(it.quantity);
          if (!Number.isFinite(qty) || qty <= 0) {
            return JSON.stringify({ ok: false, error: 'cantidad_invalida', mensaje: 'La cantidad de cada item debe ser mayor que cero.' });
          }

          let unit: number;
          let taxRate: number;
          let productId: string | null = null;
          let description: string = it.description || '';

          if (it.productId) {
            // Reject products that do not belong to this tenant (IDOR) and trust only DB values.
            const product = await prisma.product.findFirst({
              where: { id: it.productId, tenantId },
              select: { id: true, name: true, price: true },
            });
            if (!product) {
              return JSON.stringify({ ok: false, error: 'producto_no_encontrado', mensaje: 'Uno de los productos no existe o no pertenece a este negocio.' });
            }
            productId = product.id;
            unit = Number(product.price);
            // Catalog has no per-product tax rate column here; default IVA 19% for catalog items.
            taxRate = 19;
            if (!description) description = product.name;
          } else {
            // Free-text item: use LLM-supplied price/tax but validate.
            unit = parseFloat(it.unitPrice);
            taxRate = it.taxRate !== undefined ? parseFloat(it.taxRate) : 19;
            if (!Number.isFinite(taxRate) || taxRate < 0) taxRate = 0;
          }

          if (!Number.isFinite(unit) || unit <= 0) {
            return JSON.stringify({ ok: false, error: 'precio_invalido', mensaje: 'El precio de cada item debe ser mayor que cero.' });
          }

          const gross = qty * unit;
          const tax = (gross * taxRate) / 100;
          subtotal += gross; taxAmount += tax; total += gross + tax;
          normItems.push({ productId, description, qty, unit, taxRate, lineTotal: gross + tax });
        }

        const count = await prisma.invoice.count({ where: { tenantId } });
        const invoiceNumber = `FE-${String(count + 1).padStart(6, '0')}`;

        // Create a DRAFT invoice only. No Transaction marked completed, no Payment. [P0]
        const invoice = await prisma.$transaction(async (tx) => {
          const transaction = await tx.transaction.create({
            data: {
              tenantId, companyId: company.id, userId,
              customerId: boundCustomerId, type: 'sale',
              total, taxAmount, status: 'draft',
              items: {
                create: normItems
                  .filter((i: any) => i.productId)
                  .map((i: any) => ({
                    tenantId, productId: i.productId, quantity: i.qty,
                    unitPrice: i.unit, taxPercent: i.taxRate,
                    lineTotal: i.lineTotal,
                  })),
              },
            },
          });
          const inv = await tx.invoice.create({
            data: {
              tenantId, companyId: company.id, customerId: boundCustomerId,
              transactionId: transaction.id, userId,
              invoiceNumber, invoiceDate: new Date(),
              status: 'draft', subtotal, taxAmount, total,
              notes: args.notes || `Borrador generado por agente WhatsApp (${phoneNumber}) — pendiente de confirmación`,
            },
          });
          return inv;
        });

        return JSON.stringify({
          ok: true, numero: invoice.invoiceNumber,
          total: fmtCOP(invoice.total),
          id: invoice.id,
          estado: 'draft',
          mensaje: `Creé un borrador de factura (${invoice.invoiceNumber}) por ${fmtCOP(invoice.total)}. Un asesor debe confirmarlo y emitirlo desde el panel.`,
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
