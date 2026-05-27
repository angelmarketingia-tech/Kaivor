'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

interface UsageData {
  plan: string;
  invoices: { used: number; limit: number; remaining: number; percentage: number };
  features: { woocommerce: boolean; aiInsights: boolean; usersMax: number };
}

interface Integration {
  id: string;
  provider: string;
  status: string;
  storeUrl: string;
  lastSyncAt: string | null;
}

interface InvoiceStats {
  totalRevenue: number;
  totalInvoices: number;
  pendingInvoices: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [invoiceStats, setInvoiceStats] = useState<InvoiceStats | null>(null);
  const [customersCount, setCustomersCount] = useState<number | null>(null);
  const [productsCount, setProductsCount] = useState<number | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<{ steps: any[]; completed: number; total: number; percentage: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token) { router.push('/auth/login'); return; }
    if (userData) setUser(JSON.parse(userData));
    loadData(token);
  }, [router]);

  const loadData = async (token: string) => {
    const headers = { Authorization: `Bearer ${token}` };
    axios.post(`${API}/events`, { eventName: 'dashboard_viewed', path: '/dashboard' }, { headers }).catch(() => {});
    try {
      const results = await Promise.allSettled([
        axios.get(`${API}/subscriptions/usage`, { headers }),
        axios.get(`${API}/integrations`, { headers }),
        axios.get(`${API}/invoices/stats`, { headers }),
        axios.get(`${API}/customers`, { headers }),
        axios.get(`${API}/products`, { headers }),
        axios.get(`${API}/onboarding`, { headers }),
      ]);

      const [usageRes, intRes, statsRes, custRes, prodRes, onbRes] = results;
      if (onbRes.status === 'fulfilled') setOnboarding(onbRes.value.data);

      if (usageRes.status === 'fulfilled') {
        const u = usageRes.value.data;
        setUsage(u);
        if (u.features.aiInsights) {
          axios.get(`${API}/ai-insights/recommendations`, { headers }).then((r) => {
            if (r.data.recommendations?.length) setInsight(r.data.recommendations[0].body);
          }).catch(() => {});
        }
      }
      if (intRes.status === 'fulfilled') setIntegrations(intRes.value.data);
      if (statsRes.status === 'fulfilled') setInvoiceStats(statsRes.value.data);
      if (custRes.status === 'fulfilled') setCustomersCount(custRes.value.data.length);
      if (prodRes.status === 'fulfilled') setProductsCount(prodRes.value.data.length);
    } finally {
      setLoading(false);
    }
  };

  const wooIntegration = integrations.find((i) => i.provider === 'woocommerce');

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Hola{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Aquí está el resumen de tu operación.</p>
        </div>

        {/* Onboarding checklist */}
        {onboarding && onboarding.completed < onboarding.total && (
          <div className="bg-white rounded-xl border border-violet-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Configura Kaivor paso a paso</h2>
                <p className="text-xs text-slate-500">{onboarding.completed} de {onboarding.total} pasos completados</p>
              </div>
              <span className="text-lg font-bold text-violet-600">{onboarding.percentage}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
              <div className="h-2 rounded-full bg-violet-600 transition-all" style={{ width: `${onboarding.percentage}%` }} />
            </div>
            <div className="space-y-1.5">
              {onboarding.steps.filter((s) => !s.done).slice(0, 4).map((s) => (
                <Link key={s.id} href={s.href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-violet-50 transition-colors group">
                  <span className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                  <span className="text-sm text-slate-700 flex-1">{s.label}</span>
                  <span className="text-xs text-violet-600 opacity-0 group-hover:opacity-100">Ir →</span>
                </Link>
              ))}
              {onboarding.steps.filter((s) => s.done).slice(0, 2).map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 px-3 py-2 opacity-50">
                  <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[10px]">✓</span>
                  </span>
                  <span className="text-sm text-slate-500 line-through flex-1">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Ingresos del mes</p>
            <p className="text-xl font-bold text-slate-900">
              ${(invoiceStats?.totalRevenue ?? 0).toLocaleString('es-CO')}
            </p>
            <Link href="/invoices" className="text-xs text-slate-400 hover:text-violet-600 mt-0.5 inline-block">Ver facturas →</Link>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Facturas emitidas</p>
            <p className="text-xl font-bold text-slate-900">{invoiceStats?.totalInvoices ?? 0}</p>
            {(invoiceStats?.pendingInvoices ?? 0) > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">{invoiceStats?.pendingInvoices} pendientes de cobro</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Clientes</p>
            <p className="text-xl font-bold text-slate-900">{customersCount ?? '—'}</p>
            <Link href="/customers" className="text-xs text-slate-400 hover:text-violet-600 mt-0.5 inline-block">Gestionar →</Link>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Productos</p>
            <p className="text-xl font-bold text-slate-900">{productsCount ?? '—'}</p>
            <Link href="/products" className="text-xs text-slate-400 hover:text-violet-600 mt-0.5 inline-block">Gestionar →</Link>
          </div>
        </div>

        {/* Plan usage + WooCommerce + AI */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Invoice usage */}
          {usage && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex justify-between items-start mb-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Uso de facturas</p>
                <span className="text-xs font-medium text-slate-600">
                  {usage.invoices.used} / {usage.invoices.limit}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
                <div
                  className={`h-2 rounded-full transition-all ${
                    usage.invoices.percentage >= 90 ? 'bg-red-500' :
                    usage.invoices.percentage >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${usage.invoices.percentage}%` }}
                />
              </div>
              {usage.invoices.remaining === 0 ? (
                <Link href="/pricing" className="text-xs text-red-600 hover:underline font-medium">
                  Límite alcanzado — Mejorar plan →
                </Link>
              ) : usage.invoices.percentage >= 70 ? (
                <Link href="/pricing" className="text-xs text-amber-600 hover:underline">
                  Quedan {usage.invoices.remaining} facturas — Ver planes →
                </Link>
              ) : (
                <p className="text-xs text-slate-400">{usage.invoices.remaining} facturas disponibles este mes</p>
              )}
            </div>
          )}

          {/* WooCommerce */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">WooCommerce</p>
            {wooIntegration ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${wooIntegration.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <p className="text-sm font-medium text-slate-900">
                    {wooIntegration.status === 'connected' ? 'Conectado' : 'Desconectado'}
                  </p>
                </div>
                <p className="text-xs text-slate-400 truncate mb-2">{wooIntegration.storeUrl}</p>
                <Link href="/integrations/woocommerce" className="text-xs text-violet-600 hover:underline font-medium">
                  Ver sincronización →
                </Link>
              </>
            ) : usage?.features.woocommerce ? (
              <div>
                <p className="text-sm text-slate-500 mb-3">No conectado aún</p>
                <Link
                  href="/integrations/woocommerce"
                  className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 inline-block"
                >
                  Conectar tienda →
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-500 mb-2">Disponible en Pro AI y Business.</p>
                <Link href="/pricing" className="text-xs text-violet-600 hover:underline font-medium">
                  Desbloquear →
                </Link>
              </div>
            )}
          </div>

          {/* AI Insight */}
          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl border border-violet-100 p-5">
            <p className="text-xs text-violet-600 uppercase tracking-wide font-medium mb-2">✦ Kaivor AI</p>
            {insight ? (
              <>
                <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">{insight}</p>
                <Link href="/ai-insights" className="text-xs text-violet-600 hover:underline mt-2 block font-medium">
                  Ver análisis completo →
                </Link>
              </>
            ) : usage?.features.aiInsights ? (
              <p className="text-sm text-slate-500">Generando recomendaciones...</p>
            ) : (
              <div>
                <p className="text-sm text-slate-600 mb-3">Desbloquea Kaivor AI para analizar tus ventas y recibir recomendaciones automáticas.</p>
                <Link href="/pricing" className="text-xs text-violet-700 font-medium hover:underline">
                  Ver planes con IA →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Acciones rápidas</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/invoices/create"
              className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              + Nueva factura
            </Link>
            <Link
              href="/customers"
              className="border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              + Nuevo cliente
            </Link>
            <Link
              href="/products"
              className="border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              + Nuevo producto
            </Link>
            <Link
              href="/invoices"
              className="border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Ver facturas
            </Link>
            <Link
              href="/pricing"
              className="border border-violet-200 text-violet-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-50 transition-colors"
            >
              Ver planes
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
