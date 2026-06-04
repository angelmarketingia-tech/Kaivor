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
    const steps = [
      { id: 'company', label: 'Configura tu empresa', href: '/settings', done: true },
      { id: 'products', label: 'Agrega tu primer producto', href: '/products', done: hasProducts > 0 },
      { id: 'customers', label: 'Registra un cliente', href: '/customers', done: hasCustomers > 1 }, // beyond Consumidor Final
      { id: 'invoice', label: 'Emite tu primera factura', href: '/invoices/create', done: hasInvoices > 0 },
      { id: 'email', label: 'Activa el envío por email', href: '/settings', done: !!settings?.emailEnabled },
      { id: 'whatsapp', label: 'Conecta WhatsApp', href: '/settings', done: !!settings?.whatsappEnabled },
    ];
    const completed = steps.filter((s) => s.done).length;
    const total = steps.length;
    const percentage = Math.round((completed / total) * 100);
    // Derive completedSteps from the real step flags (the persisted column drifts and nothing reads it).
    const completedSteps = steps.filter((s) => s.done).map((s) => s.id);
    return {
      currentStep: p.currentStep,
      completedSteps,
      status: completed >= total ? 'completed' : p.status,
      steps,
      completed,
      total,
      percentage,
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
