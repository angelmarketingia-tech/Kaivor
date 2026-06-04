'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Subscription {
  plan: string;
  status: string;
  currentPeriodEnd: string;
}

interface Usage {
  invoicesThisMonth: number;
  invoiceLimit: number | null;
  aiCreditsUsed: number;
  features: { woocommerce: boolean; aiInsights: boolean };
}

const PLAN_LABEL: Record<string, string> = {
  FREE: 'Gratis', STARTER: 'Starter', PRO_AI: 'Pro + IA', BUSINESS: 'Business', ENTERPRISE: 'Enterprise',
};

export default function SubscriptionPage() {
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

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-default">Mi suscripción</h1>
          <p className="text-sm text-soft mt-0.5">Gestiona tu plan y uso mensual.</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-28 surface-2 animate-pulse rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {subscription && (
              <div className="surface rounded-xl border p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-semibold text-default">Plan actual</h2>
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                    subscription.plan === 'FREE' ? 'surface-2 text-soft' :
                    subscription.plan === 'PRO_AI' ? 'bg-brand text-ink-900' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {PLAN_LABEL[subscription.plan] ?? subscription.plan}
                  </span>
                </div>
                <p className="text-sm text-soft">
                  Estado: <span className="capitalize">{subscription.status}</span>
                  {subscription.currentPeriodEnd && subscription.plan !== 'FREE' && (
                    <> · Renovación: {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-CO')}</>
                  )}
                </p>
              </div>
            )}

            {usage && (
              <div className="surface rounded-xl border p-6">
                <h2 className="text-base font-semibold text-default mb-4">Uso este mes</h2>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-default font-medium">Facturas</span>
                    <span className="text-soft">
                      {usage.invoicesThisMonth}{usage.invoiceLimit ? ` / ${usage.invoiceLimit}` : ' (ilimitadas)'}
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
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 surface-2 rounded-lg">
                    <div className="text-xs text-soft mb-1">WooCommerce</div>
                    <div className={`text-sm font-medium ${usage.features.woocommerce ? 'text-emerald-600' : 'text-soft'}`}>
                      {usage.features.woocommerce ? 'Incluido' : 'No incluido'}
                    </div>
                  </div>
                  <div className="p-3 surface-2 rounded-lg">
                    <div className="text-xs text-soft mb-1">Kaivor AI</div>
                    <div className={`text-sm font-medium ${usage.features.aiInsights ? 'text-emerald-600' : 'text-soft'}`}>
                      {usage.features.aiInsights ? 'Incluido' : 'No incluido'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center pt-2">
              <Link
                href="/pricing"
                className="inline-block bg-brand text-ink-900 px-8 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-300 transition-colors"
              >
                Ver todos los planes →
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
