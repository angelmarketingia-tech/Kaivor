import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { encrypt } from '@/common/crypto.util';

// Providers the payment-integrations frontend renders.
const PAYMENT_PROVIDERS = ['nequi', 'daviplata', 'cards', 'qr', 'addi', 'bank_transfer', 'other'];

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getTenantSettings(tenantId: string) {
    let s = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!s) s = await this.prisma.tenantSettings.create({ data: { tenantId } });

    // Extra SMTP fields without a dedicated column live inside paymentConfig.__email.
    const pc: any = (s.paymentConfig as any) || {};
    const emailExtra: any = pc.__email || {};
    const brandingExtra: any = pc.__branding || {};

    // Safe payment summary: never leak ciphertext, audit logs, or receiver secrets.
    const storedProviders: any = pc.providers || {};
    const paymentSummary = Object.keys(storedProviders).map((provider) => {
      const p = storedProviders[provider] || {};
      return {
        provider,
        status: p.status || 'inactive',
        environment: p.environment || 'sandbox',
        hasKeys: !!(p.publicKeyEncrypted || p.privateKeyEncrypted),
      };
    });

    const smtpHost = s.emailHost || null;
    const smtpPort = s.emailPort || null;
    const smtpUser = s.emailUser || null;
    const emailFromAddr = s.emailFrom || null;

    // Never expose encrypted secrets
    return {
      logoUrl: s.logoUrl,
      logoData: s.logoUrl, // frontend (billing/templates) reads branding.logoData
      primaryColor: s.primaryColor,
      receiptFooter: s.receiptFooter,
      // Invoice-template / branding fields (stored in paymentConfig.__branding)
      invoiceTemplate: brandingExtra.invoiceTemplate ?? 'moderno',
      logoPosition: brandingExtra.logoPosition ?? 'left',
      logoSize: brandingExtra.logoSize ?? 'medium',
      showLogoOnInvoice: brandingExtra.showLogoOnInvoice ?? true,
      showLogoOnReceipt: brandingExtra.showLogoOnReceipt ?? true,
      showLogoOnPdf: brandingExtra.showLogoOnPdf ?? true,
      footerMessage: brandingExtra.footerMessage ?? (s.receiptFooter || 'Gracias por su compra.'),
      legalNote: brandingExtra.legalNote ?? null,
      logoFileName: brandingExtra.logoFileName ?? null,
      logoWidth: brandingExtra.logoWidth ?? null,
      logoHeight: brandingExtra.logoHeight ?? null,
      waBusinessPhone: s.whatsappPhone, // frontend integrations/whatsapp pages read this alias
      emailEnabled: s.emailEnabled,
      // SMTP shape expected by the email settings page
      smtpHost,
      smtpPort,
      smtpUser,
      smtpSecure: emailExtra.smtpSecure ?? (smtpPort === 465),
      emailFromName: emailExtra.emailFromName ?? null,
      emailFromAddr,
      hasSmtpPass: !!s.emailPassEncrypted,
      // Must match the send gate in messages.service.sendEmail (which requires emailEnabled too),
      // otherwise the UI shows "configurado" + an enabled test button that then fails.
      emailConfigured: !!(smtpHost && smtpUser && s.emailPassEncrypted && s.emailEnabled),
      // Back-compat aliases (other consumers)
      emailHost: smtpHost,
      emailPort: smtpPort,
      emailUser: smtpUser,
      emailFrom: emailFromAddr,
      hasEmailPass: !!s.emailPassEncrypted,
      whatsappEnabled: s.whatsappEnabled,
      whatsappPhone: s.whatsappPhone,
      hasWhatsappToken: !!s.whatsappTokenEncrypted,
      dianEnabled: s.dianEnabled,
      // Sanitized summary only — raw paymentConfig (ciphertext, logs, receiverInfo) is never exposed here.
      paymentProviders: paymentSummary,
    };
  }

  async updateTenantSettings(tenantId: string, data: any) {
    const update: any = {
      logoUrl: data.logoUrl,
      primaryColor: data.primaryColor,
      receiptFooter: data.receiptFooter,
      emailEnabled: data.emailEnabled,
      whatsappEnabled: data.whatsappEnabled,
      whatsappPhone: data.whatsappPhone,
      dianEnabled: data.dianEnabled,
    };

    // SMTP: accept both smtp* (frontend) and email* (legacy) names; map to email* columns.
    const host = data.smtpHost ?? data.emailHost;
    const port = data.smtpPort ?? data.emailPort;
    const user = data.smtpUser ?? data.emailUser;
    const fromAddr = data.emailFromAddr ?? data.emailFrom;
    if (host !== undefined) update.emailHost = host;
    if (port !== undefined && port !== null && port !== '') update.emailPort = parseInt(String(port), 10);
    if (user !== undefined) update.emailUser = user;
    if (fromAddr !== undefined) update.emailFrom = fromAddr;

    // Fields without a column (smtpSecure, emailFromName) are persisted in paymentConfig.__email.
    const existing = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    const pc: any = (existing?.paymentConfig as any) || {};
    const emailExtra: any = { ...(pc.__email || {}) };
    if (data.smtpSecure !== undefined) emailExtra.smtpSecure = !!data.smtpSecure;
    if (data.emailFromName !== undefined) emailExtra.emailFromName = data.emailFromName;
    pc.__email = emailExtra;

    // Invoice-template / branding fields without dedicated columns live in paymentConfig.__branding.
    const brandingExtra: any = { ...(pc.__branding || {}) };
    for (const k of ['invoiceTemplate', 'logoPosition', 'logoSize', 'showLogoOnInvoice', 'showLogoOnReceipt', 'showLogoOnPdf', 'footerMessage', 'legalNote', 'logoFileName', 'logoWidth', 'logoHeight']) {
      if (data[k] !== undefined) brandingExtra[k] = data[k];
    }
    pc.__branding = brandingExtra;

    if (data.paymentConfig) {
      // Merge to avoid clobbering __email when caller sends an explicit paymentConfig.
      update.paymentConfig = { ...pc, ...data.paymentConfig, __email: emailExtra };
    } else {
      update.paymentConfig = pc;
    }

    // SMTP password (frontend sends smtpPass; legacy emailPass). Empty = keep existing.
    const pass = data.smtpPass ?? data.emailPass;
    if (pass && pass !== '***') update.emailPassEncrypted = encrypt(pass);
    if (data.whatsappToken && data.whatsappToken !== '***') update.whatsappTokenEncrypted = encrypt(data.whatsappToken);

    // Auto-enable email once host + user + a stored password exist.
    if (update.emailHost && update.emailUser && (update.emailPassEncrypted || existing?.emailPassEncrypted)) {
      update.emailEnabled = update.emailEnabled ?? true;
    }

    // Remove undefined
    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      update,
      create: { tenantId, ...update },
    });
    return this.getTenantSettings(tenantId);
  }

  // ---- Payment integrations ----------------------------------------------

  private async loadPaymentConfig(tenantId: string): Promise<any> {
    let s = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!s) s = await this.prisma.tenantSettings.create({ data: { tenantId } });
    return (s.paymentConfig as any) || {};
  }

  private async savePaymentConfig(tenantId: string, pc: any) {
    await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      update: { paymentConfig: pc },
      create: { tenantId, paymentConfig: pc },
    });
  }

  // Returns { providers: [...], logs: [...] } in the shape the page reads.
  async getPaymentIntegrations(tenantId: string, logsFor?: string) {
    const pc = await this.loadPaymentConfig(tenantId);
    const stored: any = pc.providers || {};

    const providers = PAYMENT_PROVIDERS.map((key) => {
      const p = stored[key] || {};
      return {
        provider: key,
        status: p.status || 'inactive',
        environment: p.environment || 'sandbox',
        merchantId: p.merchantId || '',
        receiverInfo: p.receiverInfo || '',
        apiBaseUrl: p.apiBaseUrl || '',
        lastTestAt: p.lastTestAt || null,
        lastError: p.lastError || null,
        hasKeys: !!(p.publicKeyEncrypted || p.privateKeyEncrypted),
      };
    });

    let logs: any[] = [];
    if (logsFor) {
      const allLogs: any[] = pc.logs || [];
      logs = allLogs.filter((l) => l.provider === logsFor);
    }

    return { providers, logs };
  }

  // PATCH save. Whitelists fields; encrypts keys; never returns secrets.
  async savePaymentIntegration(tenantId: string, body: any) {
    const provider = body.provider;
    if (!provider || !PAYMENT_PROVIDERS.includes(provider)) {
      return { ok: false, message: 'Proveedor inválido' };
    }
    const pc = await this.loadPaymentConfig(tenantId);
    pc.providers = pc.providers || {};
    const prev = pc.providers[provider] || {};

    const next: any = {
      ...prev,
      status: body.status ?? prev.status ?? 'inactive',
      environment: body.environment ?? prev.environment ?? 'sandbox',
      merchantId: body.merchantId ?? prev.merchantId ?? '',
      receiverInfo: body.receiverInfo ?? prev.receiverInfo ?? '',
      apiBaseUrl: body.apiBaseUrl ?? prev.apiBaseUrl ?? '',
    };
    // Keys: empty string = keep existing; non-empty = encrypt & store.
    if (body.publicKey) next.publicKeyEncrypted = encrypt(body.publicKey);
    if (body.privateKey) next.privateKeyEncrypted = encrypt(body.privateKey);

    pc.providers[provider] = next;

    pc.logs = pc.logs || [];
    pc.logs.unshift({
      id: `${Date.now()}-${provider}`,
      provider,
      action: 'save',
      status: 'ok',
      message: 'Configuración guardada',
      environment: next.environment,
      createdAt: new Date().toISOString(),
    });
    pc.logs = pc.logs.slice(0, 100);

    await this.savePaymentConfig(tenantId, pc);
    return { ok: true, message: 'Integración guardada' };
  }

  // POST test connection. Records a log and updates lastTestAt/lastError.
  async testPaymentIntegration(tenantId: string, provider: string) {
    if (!provider || !PAYMENT_PROVIDERS.includes(provider)) {
      return { ok: false, message: 'Proveedor inválido' };
    }
    const pc = await this.loadPaymentConfig(tenantId);
    pc.providers = pc.providers || {};
    const p = pc.providers[provider] || {};

    // Operative validation: ensure required config is present per provider type.
    const needsReceiver = ['nequi', 'daviplata', 'qr', 'bank_transfer'].includes(provider);
    const needsKeys = ['cards', 'addi'].includes(provider);
    let ok = true;
    let message = 'Conexión validada correctamente';

    if (needsReceiver && !p.receiverInfo) {
      ok = false;
      message = 'Falta el número / cuenta receptora';
    } else if (needsKeys && !(p.privateKeyEncrypted || p.publicKeyEncrypted)) {
      ok = false;
      message = 'Faltan las credenciales del proveedor';
    }

    const now = new Date().toISOString();
    p.lastTestAt = now;
    p.lastError = ok ? null : message;
    if (ok && p.status === 'inactive') p.status = 'active';
    if (!ok) p.status = 'error';
    pc.providers[provider] = p;

    pc.logs = pc.logs || [];
    pc.logs.unshift({
      id: `${Date.now()}-${provider}`,
      provider,
      action: 'test',
      status: ok ? 'ok' : 'error',
      message,
      environment: p.environment || 'sandbox',
      createdAt: now,
    });
    pc.logs = pc.logs.slice(0, 100);

    await this.savePaymentConfig(tenantId, pc);
    return { ok, message };
  }
}
