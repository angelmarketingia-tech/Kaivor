import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';
import { Prisma } from '@prisma/client';
import { ConnectWooCommerceDto } from './dto/connect-woocommerce.dto';
import { normalizeStoreUrl } from './utils/normalize-store-url';
import { verifyWooCommerceWebhookSignature } from './utils/verify-webhook-signature';
import * as crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'admia-v15-default-key-32byteslong!!';
const ALGO = 'aes-256-cbc';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(encoded: string): string {
  const [ivHex, encHex] = encoded.split(':');
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

@Injectable()
export class WooCommerceService {
  private readonly logger = new Logger(WooCommerceService.name);

  constructor(
    private prisma: PrismaService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async connect(tenantId: string, dto: ConnectWooCommerceDto) {
    // Verificar que el plan permite WooCommerce
    await this.subscriptionsService.requireFeature(tenantId, 'woocommerce');

    const storeUrl = normalizeStoreUrl(dto.storeUrl);

    // Probar conexión antes de guardar
    await this.testConnectionWithCredentials(storeUrl, dto.consumerKey, dto.consumerSecret);

    // Generar webhook secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // Crear integración
    const integration = await this.prisma.integration.create({
      data: {
        tenantId,
        provider: 'woocommerce',
        status: 'connected',
        storeUrl,
        country: dto.country,
        currency: dto.currency,
      },
    });

    // Guardar credenciales cifradas (nunca en texto plano)
    await this.prisma.integrationCredential.create({
      data: {
        integrationId: integration.id,
        consumerKeyEncrypted: encrypt(dto.consumerKey),
        consumerSecretEncrypted: encrypt(dto.consumerSecret),
        webhookSecretEncrypted: encrypt(webhookSecret),
      },
    });

    await this.logIntegration(integration.id, 'info', 'integration.connected', 'WooCommerce conectado exitosamente');

    // Lanzar sync inicial en background (sin bloquear respuesta)
    this.syncOrders(integration.id, tenantId).catch((err) => {
      this.logger.warn(`Sync inicial falló: ${err.message}`);
    });

    const webhookUrl = `${process.env.API_URL || 'https://api.kaivor.com'}/integrations/woocommerce/webhook/${integration.id}`;

    return {
      id: integration.id,
      storeUrl: integration.storeUrl,
      status: integration.status,
      webhookUrl,
      // webhookSecret solo se devuelve UNA VEZ al conectar
      webhookSecret,
      message: 'Tienda conectada exitosamente. Guarda el secreto de webhook — no se mostrará de nuevo.',
    };
  }

  async testConnection(tenantId: string, dto: { storeUrl: string; consumerKey: string; consumerSecret: string }) {
    await this.subscriptionsService.requireFeature(tenantId, 'woocommerce');
    const storeUrl = normalizeStoreUrl(dto.storeUrl);
    await this.testConnectionWithCredentials(storeUrl, dto.consumerKey, dto.consumerSecret);
    return { success: true, message: 'Conexión exitosa con la tienda WooCommerce.' };
  }

  private async testConnectionWithCredentials(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
  ) {
    const url = `${storeUrl}/wp-json/wc/v3/orders?per_page=1`;
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Basic ${credentials}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new BadRequestException(
          'No pudimos conectar tu tienda. Revisa que la URL, Consumer Key y Consumer Secret sean correctos.',
        );
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        'No pudimos conectar tu tienda. Verifica que la URL sea accesible y las credenciales sean correctas.',
      );
    }
  }

  async getIntegrations(tenantId: string) {
    return this.prisma.integration.findMany({
      where: { tenantId },
      select: {
        id: true,
        provider: true,
        status: true,
        storeUrl: true,
        country: true,
        currency: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
        // credential NEVER returned to frontend
      },
    });
  }

  async getIntegration(id: string, tenantId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        provider: true,
        status: true,
        storeUrl: true,
        country: true,
        currency: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!integration) {
      throw new NotFoundException('Integración no encontrada');
    }

    return integration;
  }

  async getLogs(integrationId: string, tenantId: string) {
    // Verificar ownership
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, tenantId },
    });

    if (!integration) {
      throw new NotFoundException('Integración no encontrada');
    }

    return this.prisma.integrationLog.findMany({
      where: { integrationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async disconnect(integrationId: string, tenantId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, tenantId },
    });

    if (!integration) {
      throw new NotFoundException('Integración no encontrada');
    }

    await this.prisma.integration.update({
      where: { id: integrationId },
      data: { status: 'disconnected' },
    });

    await this.logIntegration(integrationId, 'info', 'integration.disconnected', 'WooCommerce desconectado');

    return { success: true, message: 'Integración desconectada correctamente.' };
  }

  async syncOrders(integrationId: string, tenantId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, tenantId },
      include: { credential: true },
    });

    if (!integration || !integration.credential) {
      throw new NotFoundException('Integración no encontrada o sin credenciales');
    }

    const consumerKey = decrypt(integration.credential.consumerKeyEncrypted!);
    const consumerSecret = decrypt(integration.credential.consumerSecretEncrypted!);

    const url = `${integration.storeUrl}/wp-json/wc/v3/orders?per_page=50&orderby=date&order=desc`;
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    let orders: any[] = [];

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Basic ${credentials}` },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`WooCommerce API respondió ${response.status}`);
      }

      orders = await response.json() as any[];
    } catch (err: any) {
      await this.logIntegration(integrationId, 'error', 'sync.failed', `Error al sincronizar: ${err.message}`);
      throw new BadRequestException(`Error al sincronizar con WooCommerce: ${err.message}`);
    }

    let imported = 0;
    let skipped = 0;

    for (const order of orders) {
      try {
        const processed = await this.processOrder(order, integration, tenantId);
        if (processed) imported++;
        else skipped++;
      } catch (err: any) {
        await this.logIntegration(
          integrationId,
          'warning',
          'sync.order_skipped',
          `Pedido ${order.id} omitido: ${err.message}`,
          { orderId: order.id },
        );
        skipped++;
      }
    }

    await this.prisma.integration.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date() },
    });

    await this.logIntegration(
      integrationId,
      'info',
      'sync.completed',
      `Sync completado: ${imported} importados, ${skipped} omitidos`,
      { imported, skipped },
    );

    await this.subscriptionsService.trackUsage(
      tenantId,
      'woocommerce_order_imported',
      imported,
      { integrationId, imported, skipped },
    );

    return { imported, skipped, total: orders.length };
  }

  async processWebhook(
    integrationId: string,
    topic: string,
    rawBody: Buffer,
    signature: string,
    payload: any,
  ) {
    // 1. Buscar integración
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, status: 'connected' },
      include: { credential: true },
    });

    if (!integration || !integration.credential) {
      return { ignored: true, reason: 'Integration not found or disconnected' };
    }

    // 2. Validar firma webhook (SIEMPRE)
    const webhookSecret = decrypt(integration.credential.webhookSecretEncrypted!);
    const isValid = verifyWooCommerceWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      await this.logIntegration(
        integrationId,
        'warning',
        'webhook.invalid_signature',
        'Firma de webhook inválida — solicitud rechazada',
      );
      return { ignored: true, reason: 'Invalid signature' };
    }

    const externalId = String(payload.id);

    // 3. Verificar duplicado (idempotencia)
    const existing = await this.prisma.integrationWebhookEvent.findUnique({
      where: {
        integrationId_topic_externalId: { integrationId, topic, externalId },
      },
    });

    if (existing?.processed) {
      return { ignored: true, reason: 'Already processed' };
    }

    // 4. Guardar evento
    const webhookEvent = await this.prisma.integrationWebhookEvent.upsert({
      where: {
        integrationId_topic_externalId: { integrationId, topic, externalId },
      },
      create: {
        integrationId,
        topic,
        externalId,
        payload,
        processed: false,
      },
      update: {
        payload,
        processed: false,
        processedAt: null,
        error: null,
      },
    });

    // 5. Procesar pedido
    try {
      await this.processOrder(payload, integration, integration.tenantId);

      await this.prisma.integrationWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date() },
      });

      await this.logIntegration(
        integrationId,
        'info',
        'webhook.processed',
        `Webhook ${topic} procesado para pedido ${externalId}`,
        { externalId, topic },
      );

      return { success: true, orderId: externalId };
    } catch (err: any) {
      await this.prisma.integrationWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: { error: err.message },
      });

      await this.logIntegration(
        integrationId,
        'error',
        'webhook.processing_failed',
        `Error procesando webhook ${topic}: ${err.message}`,
        { externalId, topic, error: err.message },
      );

      return { success: false, error: err.message };
    }
  }

  private async processOrder(
    order: any,
    integration: any,
    tenantId: string,
  ): Promise<boolean> {
    const externalId = String(order.id);
    const status = order.status as string;

    // Estados que no generan factura
    if (['pending', 'failed', 'trash', 'on-hold'].includes(status)) {
      return false;
    }

    // Verificar referencia externa (evitar duplicados)
    const existingRef = await this.prisma.externalReference.findUnique({
      where: {
        tenantId_provider_externalType_externalId: {
          tenantId,
          provider: 'woocommerce',
          externalType: 'order',
          externalId,
        },
      },
    });

    if (existingRef && existingRef.internalType === 'invoice') {
      // Solo actualizar si el pedido fue cancelado o reembolsado
      if (['cancelled', 'refunded'].includes(status)) {
        await this.prisma.invoice.update({
          where: { id: existingRef.internalId },
          data: { status: status === 'cancelled' ? 'cancelled' : 'cancelled' },
        }).catch(() => {/* ignorar si no existe */});
      }
      return false; // no duplicar
    }

    // Buscar o crear empresa del tenant
    const company = await this.prisma.company.findFirst({
      where: { tenantId },
    });

    if (!company) return false;

    // Crear o actualizar cliente
    const billing = order.billing || {};
    const customerEmail = billing.email || null;
    const customerName = [billing.first_name, billing.last_name].filter(Boolean).join(' ') || 'Cliente WooCommerce';

    let customer = customerEmail
      ? await this.prisma.customer.findFirst({
          where: { tenantId, email: customerEmail },
        })
      : null;

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          tenantId,
          companyId: company.id,
          name: customerName,
          email: customerEmail,
          phone: billing.phone,
          address: billing.address_1,
          city: billing.city,
        },
      });
    }

    // Estados que generan factura
    if (['processing', 'completed'].includes(status)) {
      const total = parseFloat(order.total || '0');
      const taxTotal = parseFloat(order.total_tax || '0');

      const invoice = await this.prisma.invoice.create({
        data: {
          tenantId,
          companyId: company.id,
          customerId: customer.id,
          invoiceNumber: `WC-${externalId}`,
          invoiceDate: new Date(order.date_created || Date.now()),
          status: status === 'completed' ? 'sent' : 'draft',
          subtotal: total - taxTotal,
          taxAmount: taxTotal,
          total,
          notes: `Importado de WooCommerce. Pedido #${externalId}`,
        },
      });

      // Registrar referencia externa
      await this.prisma.externalReference.create({
        data: {
          tenantId,
          provider: 'woocommerce',
          externalType: 'order',
          externalId,
          internalType: 'invoice',
          internalId: invoice.id,
        },
      });

      // Tracking de uso
      await this.subscriptionsService.trackUsage(
        tenantId,
        'woocommerce_order_imported',
        1,
        { orderId: externalId, invoiceId: invoice.id },
      );

      return true;
    }

    return false;
  }

  private async logIntegration(
    integrationId: string,
    level: string,
    event: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.integrationLog.create({
      data: {
        integrationId,
        level,
        event,
        message,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    }).catch(() => {/* log no crítico */});
  }
}
