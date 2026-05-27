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
            className="text-sm text-slate-500 hover:text-slate-900 mb-3 inline-flex items-center gap-1"
          >
            ← Configuración
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Facturación y plan</h1>
          <p className="text-sm text-slate-500 mt-0.5">Tu suscripción actual y uso de este mes.</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Invoice design */}
            <Link href="/settings/billing/templates"
              className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-violet-300 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎨</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Diseño de factura</p>
                    <p className="text-xs text-slate-500">Logo PNG, colores, plantillas y optimización con IA.</p>
                  </div>
                </div>
                <span className="text-slate-400">→</span>
              </div>
            </Link>

            {/* Current plan */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Plan actual</p>
                  <p className="text-xl font-bold text-slate-900">{PLAN_LABEL[plan] ?? plan}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{PLAN_LIMITS[plan] ?? ''}</p>
                  {subscription?.currentPeriodEnd && plan !== 'FREE' && (
                    <p className="text-xs text-slate-400 mt-1">
                      Renovación: {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-CO')}
                    </p>
                  )}
                </div>
                <span className={`text-xs font-medium px-3 py-1.5 rounded-full flex-shrink-0 ${
                  plan === 'FREE' ? 'bg-slate-100 text-slate-600' :
                  plan === 'PRO_AI' ? 'bg-violet-100 text-violet-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {subscription?.status === 'active' ? 'Activo' : subscription?.status ?? '—'}
                </span>
              </div>

              <div className="mt-5 pt-5 border-t border-slate-100">
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
                >
                  {plan === 'FREE' || plan === 'STARTER' ? 'Mejorar plan →' : 'Ver todos los planes →'}
                </Link>
              </div>
            </div>

            {/* Usage this month */}
            {usage && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-4">Uso este mes</p>

                <div className="mb-5">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-700 font-medium">Facturas</span>
                    <span className="text-slate-600">
                      {usage.invoicesThisMonth}
                      {usage.invoiceLimit ? ` / ${usage.invoiceLimit}` : ' (ilimitadas)'}
                    </span>
                  </div>
                  {usage.invoiceLimit && (
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">WooCommerce</p>
                    <p className={`text-sm font-medium ${usage.features.woocommerce ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {usage.features.woocommerce ? 'Incluido' : 'No incluido'}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Kaivor AI</p>
                    <p className={`text-sm font-medium ${usage.features.aiInsights ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {usage.features.aiInsights ? 'Incluido' : 'No incluido'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Upgrade callout for free plans */}
            {(plan === 'FREE' || plan === 'STARTER') && (
              <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl border border-violet-100 p-5">
                <p className="text-sm font-semibold text-violet-900 mb-1">
                  {plan === 'FREE' ? 'Desbloquea IA, WooCommerce y más facturas' : 'Desbloquea IA y WooCommerce'}
                </p>
                <p className="text-sm text-violet-700 mb-4">
                  Con Pro AI obtienes 500 facturas, Kaivor AI completo y sincronización con tu tienda.
                </p>
                <Link
                  href="/pricing"
                  className="inline-block bg-violet-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
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
