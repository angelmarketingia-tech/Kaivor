'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Subscription {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
}

interface Usage {
  invoicesThisMonth: number;
  invoiceLimit: number | null;
  features: { woocommerce: boolean; aiInsights: boolean; usersMax?: number };
}

const PLAN_LABEL: Record<string, string> = {
  FREE: 'Gratis', STARTER: 'Starter', PRO_AI: 'Pro AI', BUSINESS: 'Business', ENTERPRISE: 'Enterprise',
};

const PLAN_LIMITS: Record<string, string> = {
  FREE: '45 facturas / mes',
  STARTER: '150 facturas / mes',
  PRO_AI: '500 facturas / mes',
  BUSINESS: 'Facturas ilimitadas',
  ENTERPRISE: 'Facturas ilimitadas',
};

export default function SettingsBillingPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled([
      axios.get(`${API}/subscriptions/current`, { headers }),
      axios.get(`${API}/subscriptions/usage`, { headers }),
    ]).then(([subRes, usageRes]) => {
      if (subRes.status === 'fulfilled') setSubscription(subRes.value.data);
      if (usageRes.status === 'fulfilled') setUsage(usageRes.value.data);
    }).finally(() => setLoading(false));
  }, [router]);

  const invoicePercent = usage?.invoiceLimit
    ? Math.min(100, Math.round((usage.invoicesThisMonth / usage.invoiceLimit) * 100))
    : 0;

  const plan = subscription?.plan ?? 'FREE';

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/settings')}
            className="text-sm text-soft hover:text-default mb-3 inline-flex items-center gap-1"
          >
            ← Configuración
          </button>
          <h1 className="text-2xl font-bold text-default">Facturación y plan</h1>
          <p className="text-sm text-soft mt-0.5">Tu suscripción actual y uso de este mes.</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-28 surface-2 animate-pulse rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Invoice design */}
            <Link href="/settings/billing/templates"
              className="block surface rounded-xl border p-5 hover:border-brand transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎨</span>
                  <div>
                    <p className="text-sm font-semibold text-default">Diseño de factura</p>
                    <p className="text-xs text-soft">Logo PNG, colores, plantillas y optimización con IA.</p>
                  </div>
                </div>
                <span className="text-soft">→</span>
              </div>
            </Link>

            {/* Current plan */}
            <div className="surface rounded-xl border p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-soft uppercase tracking-wide mb-1">Plan actual</p>
                  <p className="text-xl font-bold text-default">{PLAN_LABEL[plan] ?? plan}</p>
                  <p className="text-sm text-soft mt-0.5">{PLAN_LIMITS[plan] ?? ''}</p>
                  {subscription?.currentPeriodEnd && plan !== 'FREE' && (
                    <p className="text-xs text-soft mt-1">
                      Renovación: {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-CO')}
                    </p>
                  )}
                </div>
                <span className={`text-xs font-medium px-3 py-1.5 rounded-full flex-shrink-0 ${
                  plan === 'FREE' ? 'surface-2 text-soft' :
                  plan === 'PRO_AI' ? 'bg-brand-50 text-brand' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {subscription?.status === 'active' ? 'Activo' : subscription?.status ?? '—'}
                </span>
              </div>

              <div className="mt-5 pt-5 border-t border-default">
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 bg-brand text-ink-900 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-300 transition-colors"
                >
                  {plan === 'FREE' || plan === 'STARTER' ? 'Mejorar plan →' : 'Ver todos los planes →'}
                </Link>
              </div>
            </div>

            {/* Usage this month */}
            {usage && (
              <div className="surface rounded-xl border p-6">
                <p className="text-xs text-soft uppercase tracking-wide mb-4">Uso este mes</p>

                <div className="mb-5">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-default font-medium">Facturas</span>
                    <span className="text-soft">
                      {usage.invoicesThisMonth}
                      {usage.invoiceLimit ? ` / ${usage.invoiceLimit}` : ' (ilimitadas)'}
                    </span>
                  </div>
                  {usage.invoiceLimit && (
                    <div className="h-2 surface-2 rounded-full overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          invoicePercent >= 90 ? 'bg-red-500' :
                          invoicePercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${invoicePercent}%` }}
                      />
                    </div>
                  )}
                  {invoicePercent >= 80 && (
                    <p className="text-xs text-amber-600 mt-1.5">
                      Estás usando el {invoicePercent}% de tu límite.{' '}
                      <Link href="/pricing" className="font-medium underline">Mejorar plan →</Link>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="surface-2 rounded-lg p-3">
                    <p className="text-xs text-soft mb-1">WooCommerce</p>
                    <p className={`text-sm font-medium ${usage.features.woocommerce ? 'text-emerald-600' : 'text-soft'}`}>
                      {usage.features.woocommerce ? 'Incluido' : 'No incluido'}
                    </p>
                  </div>
                  <div className="surface-2 rounded-lg p-3">
                    <p className="text-xs text-soft mb-1">Kaivor AI</p>
                    <p className={`text-sm font-medium ${usage.features.aiInsights ? 'text-emerald-600' : 'text-soft'}`}>
                      {usage.features.aiInsights ? 'Incluido' : 'No incluido'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Upgrade callout for free plans */}
            {(plan === 'FREE' || plan === 'STARTER') && (
              <div className="surface rounded-xl border p-5" style={{ background: 'linear-gradient(135deg, rgba(163,204,57,0.12), rgba(11,18,32,0.04))' }}>
                <p className="text-sm font-semibold text-default mb-1">
                  {plan === 'FREE' ? 'Desbloquea IA, WooCommerce y más facturas' : 'Desbloquea IA y WooCommerce'}
                </p>
                <p className="text-sm text-soft mb-4">
                  Con Pro AI obtienes 500 facturas, Kaivor AI completo y sincronización con tu tienda.
                </p>
                <Link
                  href="/pricing"
                  className="inline-block bg-brand text-ink-900 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-brand-300 transition-colors"
                >
                  Ver Pro AI →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
