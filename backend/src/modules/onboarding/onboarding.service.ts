import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async get(tenantId: string) {
    let p = await this.prisma.onboardingProgress.findUnique({ where: { tenantId } });
    if (!p) p = await this.prisma.onboardingProgress.create({ data: { tenantId } });
    // Derive completion from real data so the checklist reflects reality
    const [hasProducts, hasCustomers, hasInvoices, settings] = await Promise.all([
      this.prisma.product.count({ where: { tenantId } }),
      this.prisma.customer.count({ where: { tenantId } }),
      this.prisma.invoice.count({ where: { tenantId } }),
      this.prisma.tenantSettings.findUnique({ where: { tenantId } }),
    ]);
    const steps = {
      company: true,
      products: hasProducts > 0,
      customers: hasCustomers > 1, // beyond Consumidor Final
      invoice: hasInvoices > 0,
      email: !!settings?.emailEnabled,
      whatsapp: !!settings?.whatsappEnabled,
    };
    const done = Object.values(steps).filter(Boolean).length;
    const total = Object.keys(steps).length;
    return {
      currentStep: p.currentStep,
      completedSteps: p.completedSteps,
      status: done >= total ? 'completed' : p.status,
      steps,
      percent: Math.round((done / total) * 100),
    };
  }

  async update(tenantId: string, data: any) {
    const existing = await this.prisma.onboardingProgress.findUnique({ where: { tenantId } });
    const completed = new Set([...(existing?.completedSteps || []), ...(data.completeStep ? [data.completeStep] : [])]);
    return this.prisma.onboardingProgress.upsert({
      where: { tenantId },
      update: { currentStep: data.currentStep, completedSteps: Array.from(completed), status: data.status },
      create: { tenantId, currentStep: data.currentStep || 'welcome', completedSteps: Array.from(completed) },
    });
  }
}
