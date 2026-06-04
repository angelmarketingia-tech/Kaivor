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

interface Vertical {
  id: string;
  label: string;
  emoji: string;
  description?: string;
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
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [savingVertical, setSavingVertical] = useState<string | null>(null);
  const [verticalDone, setVerticalDone] = useState(false);
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
        axios.get(`${API}/companies/my`, { headers }),
        axios.get(`${API}/companies/verticals`, { headers }),
      ]);

      const [usageRes, intRes, statsRes, custRes, prodRes, onbRes, companyRes, vertRes] = results;
      if (onbRes.status === 'fulfilled') setOnboarding(onbRes.value.data);
      if (companyRes.status === 'fulfilled') setBusinessType(companyRes.value.data.businessType ?? null);
      if (vertRes.status === 'fulfilled') setVerticals(vertRes.value.data.verticals ?? []);

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

  const pickVertical = async (id: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setSavingVertical(id);
    try {
      await axios.patch(`${API}/companies/my`, { businessType: id }, { headers: { Authorization: `Bearer ${token}` } });
      setBusinessType(id);
      setVerticalDone(true);
    } catch {
      // keep card visible on failure
    } finally {
      setSavingVertical(null);
    }
  };

  const showVerticalPrompt = !verticalDone && verticals.length > 0 && (!businessType || businessType === 'generic');

  const wooIntegration = integrations.find((i) => i.provider === 'woocommerce');

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 surface-2 animate-pulse rounded-xl" />
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
          <h1 className="text-2xl font-bold text-default">
            Hola{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-soft mt-0.5">Aquí está el resumen de tu operación.</p>
        </div>

        {/* Business type first-run nudge */}
        {showVerticalPrompt && (
          <div className="surface rounded-xl border p-5 mb-6" style={{ background: 'linear-gradient(135deg, rgba(163,204,57,0.12), rgba(11,18,32,0.04))', borderColor: 'rgba(163,204,57,0.25)' }}>
            <h2 className="text-base font-semibold text-default">¿Qué tipo de negocio tienes?</h2>
            <p className="text-xs text-soft mt-0.5 mb-4">
              Elige tu rubro para personalizar Kaivor a tu medida.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {verticals.filter((v) => v.id !== 'generic').map((v) => (
                <button
                  key={v.id}
                  onClick={() => pickVertical(v.id)}
                  disabled={!!savingVertical}
                  title={v.description}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-default surface hover:border-brand transition-colors text-left disabled:opacity-50"
                >
                  <span className="text-xl flex-shrink-0">{v.emoji}</span>
                  <span className="text-sm font-medium text-default flex-1 truncate">
                    {savingVertical === v.id ? 'Guardando…' : v.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Onboarding checklist */}
        {onboarding && onboarding.completed < onboarding.total && (
          <div className="surface rounded-xl border p-5 mb-6" style={{ borderColor: 'rgba(163,204,57,0.3)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-default">Configura Kaivor paso a paso</h2>
                <p className="text-xs text-soft">{onboarding.completed} de {onboarding.total} pasos completados</p>
              </div>
              <span className="text-lg font-bold text-brand">{onboarding.percentage}%</span>
            </div>
            <div className="w-full surface-2 rounded-full h-2 mb-4">
              <div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${onboarding.percentage}%` }} />
            </div>
            <div className="space-y-1.5">
              {onboarding.steps.filter((s) => !s.done).slice(0, 4).map((s) => (
                <Link key={s.id} href={s.href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                  <span className="w-4 h-4 rounded-full border-2 border-default flex-shrink-0" />
                  <span className="text-sm text-default flex-1">{s.label}</span>
                  <span className="text-xs text-brand opacity-0 group-hover:opacity-100">Ir →</span>
                </Link>
              ))}
              {onboarding.steps.filter((s) => s.done).slice(0, 2).map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 px-3 py-2 opacity-50">
                  <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[10px]">✓</span>
                  </span>
                  <span className="text-sm text-soft line-through flex-1">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="surface rounded-xl border p-4 relative overflow-hidden">
            <span className="absolute top-0 left-0 h-full w-1 bg-brand" />
            <p className="text-xs text-soft uppercase tracking-wide mb-1">Ingresos del mes</p>
            <p className="text-xl font-bold text-default">
              ${(invoiceStats?.totalRevenue ?? 0).toLocaleString('es-CO')}
            </p>
            <Link href="/invoices" className="text-xs text-soft hover:text-brand mt-0.5 inline-block">Ver facturas →</Link>
          </div>

          <div className="surface rounded-xl border p-4">
            <p className="text-xs text-soft uppercase tracking-wide mb-1">Facturas emitidas</p>
            <p className="text-xl font-bold text-default">{invoiceStats?.totalInvoices ?? 0}</p>
            {(invoiceStats?.pendingInvoices ?? 0) > 0 && (
              <p className="text-xs text-amber-500 mt-0.5">{invoiceStats?.pendingInvoices} pendientes de cobro</p>
            )}
          </div>

          <div className="surface rounded-xl border p-4">
            <p className="text-xs text-soft uppercase tracking-wide mb-1">Clientes</p>
            <p className="text-xl font-bold text-default">{customersCount ?? '—'}</p>
            <Link href="/customers" className="text-xs text-soft hover:text-brand mt-0.5 inline-block">Gestionar →</Link>
          </div>

          <div className="surface rounded-xl border p-4">
            <p className="text-xs text-soft uppercase tracking-wide mb-1">Productos</p>
            <p className="text-xl font-bold text-default">{productsCount ?? '—'}</p>
            <Link href="/products" className="text-xs text-soft hover:text-brand mt-0.5 inline-block">Gestionar →</Link>
          </div>
        </div>

        {/* Plan usage + WooCommerce + AI */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Invoice usage */}
          {usage && (
            <div className="surface rounded-xl border p-5">
              <div className="flex justify-between items-start mb-3">
                <p className="text-xs text-soft uppercase tracking-wide">Uso de facturas</p>
                <span className="text-xs font-medium text-default">
                  {usage.invoices.used} / {usage.invoices.limit}
                </span>
              </div>
              <div className="w-full surface-2 rounded-full h-2 mb-3">
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
                <p className="text-xs text-soft">{usage.invoices.remaining} facturas disponibles este mes</p>
              )}
            </div>
          )}

          {/* WooCommerce */}
          <div className="surface rounded-xl border p-5">
            <p className="text-xs text-soft uppercase tracking-wide mb-3">WooCommerce</p>
            {wooIntegration ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${wooIntegration.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <p className="text-sm font-medium text-default">
                    {wooIntegration.status === 'connected' ? 'Conectado' : 'Desconectado'}
                  </p>
                </div>
                <p className="text-xs text-soft truncate mb-2">{wooIntegration.storeUrl}</p>
                <Link href="/integrations/woocommerce" className="text-xs text-brand hover:underline font-medium">
                  Ver sincronización →
                </Link>
              </>
            ) : usage?.features.woocommerce ? (
              <div>
                <p className="text-sm text-soft mb-3">No conectado aún</p>
                <Link
                  href="/integrations/woocommerce"
                  className="text-xs bg-ink-900 text-white px-3 py-1.5 rounded-lg hover:bg-ink-700 inline-block"
                >
                  Conectar tienda →
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-xs text-soft mb-2">Disponible en Pro AI y Business.</p>
                <Link href="/pricing" className="text-xs text-brand hover:underline font-medium">
                  Desbloquear →
                </Link>
              </div>
            )}
          </div>

          {/* AI Insight */}
          <div className="rounded-xl border p-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(163,204,57,0.12), rgba(11,18,32,0.04))', borderColor: 'rgba(163,204,57,0.25)' }}>
            <p className="text-xs uppercase tracking-wide font-semibold mb-2 text-brand">✦ Kaivor AI</p>
            {insight ? (
              <>
                <p className="text-sm text-default leading-relaxed line-clamp-3">{insight}</p>
                <Link href="/ai-insights" className="text-xs text-brand hover:underline mt-2 block font-medium">
                  Ver análisis completo →
                </Link>
              </>
            ) : usage?.features.aiInsights ? (
              <p className="text-sm text-soft">Generando recomendaciones...</p>
            ) : (
              <div>
                <p className="text-sm text-soft mb-3">Desbloquea Kaivor AI para analizar tus ventas y recibir recomendaciones automáticas.</p>
                <Link href="/pricing" className="text-xs font-medium hover:underline text-brand">
                  Ver planes con IA →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="surface rounded-xl border p-5">
          <h2 className="text-sm font-semibold text-default mb-4">Acciones rápidas</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/invoices/create"
              className="bg-brand text-ink-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-300 transition-colors"
            >
              + Nueva factura
            </Link>
            <Link
              href="/customers"
              className="border border-default text-default px-4 py-2 rounded-lg text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              + Nuevo cliente
            </Link>
            <Link
              href="/products"
              className="border border-default text-default px-4 py-2 rounded-lg text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              + Nuevo producto
            </Link>
            <Link
              href="/invoices"
              className="border border-default text-default px-4 py-2 rounded-lg text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Ver facturas
            </Link>
            <Link
              href="/pricing"
              className="border px-4 py-2 rounded-lg text-sm font-medium text-brand transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: 'rgba(163,204,57,0.4)' }}
            >
              Ver planes
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
