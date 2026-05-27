import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { encrypt } from '@/common/crypto.util';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getTenantSettings(tenantId: string) {
    let s = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!s) s = await this.prisma.tenantSettings.create({ data: { tenantId } });
    // Never expose encrypted secrets
    return {
      logoUrl: s.logoUrl,
      primaryColor: s.primaryColor,
      receiptFooter: s.receiptFooter,
      emailEnabled: s.emailEnabled,
      emailHost: s.emailHost,
      emailPort: s.emailPort,
      emailUser: s.emailUser,
      emailFrom: s.emailFrom,
      hasEmailPass: !!s.emailPassEncrypted,
      whatsappEnabled: s.whatsappEnabled,
      whatsappPhone: s.whatsappPhone,
      hasWhatsappToken: !!s.whatsappTokenEncrypted,
      dianEnabled: s.dianEnabled,
      paymentConfig: s.paymentConfig,
    };
  }

  async updateTenantSettings(tenantId: string, data: any) {
    const update: any = {
      logoUrl: data.logoUrl,
      primaryColor: data.primaryColor,
      receiptFooter: data.receiptFooter,
      emailEnabled: data.emailEnabled,
      emailHost: data.emailHost,
      emailPort: data.emailPort ? parseInt(data.emailPort) : null,
      emailUser: data.emailUser,
      emailFrom: data.emailFrom,
      whatsappEnabled: data.whatsappEnabled,
      whatsappPhone: data.whatsappPhone,
      dianEnabled: data.dianEnabled,
    };
    if (data.paymentConfig) update.paymentConfig = data.paymentConfig;
    if (data.emailPass && data.emailPass !== '***') update.emailPassEncrypted = encrypt(data.emailPass);
    if (data.whatsappToken && data.whatsappToken !== '***') update.whatsappTokenEncrypted = encrypt(data.whatsappToken);

    // Remove undefined
    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      update,
      create: { tenantId, ...update },
    });
    return this.getTenantSettings(tenantId);
  }

  getPaymentIntegrations(tenantId: string) {
    return this.getTenantSettings(tenantId).then((s) => s.paymentConfig || {});
  }
}
