'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Recommendation {
  type: string;
  title: string;
  body: string;
  priority: string;
}

interface MonthlySummary {
  period: string;
  totalRevenue: number;
  totalInvoices: number;
  pendingInvoices: number;
  topProduct: string;
  summary: string;
  topCustomers: { name: string; revenue: number; percentage: number }[];
}

const priorityColor: Record<string, string> = {
  high: 'border-red-400 bg-red-50',
  medium: 'border-amber-400 bg-amber-50',
  low: 'border-emerald-400 bg-emerald-50',
  positive: 'border-emerald-400 bg-emerald-50',
};

export default function AiInsightsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled([
      axios.get(`${API}/ai-insights/monthly-summary`, { headers }),
      axios.get(`${API}/ai-insights/recommendations`, { headers }),
    ]).then(([summaryRes, recRes]) => {
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data);
      if (recRes.status === 'fulfilled') setRecommendations(recRes.value.data.recommendations ?? []);
      if (summaryRes.status === 'rejected') {
        setError(summaryRes.reason?.response?.data?.message || 'Plan no incluye Kaivor AI');
      }
    }).finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 surface-2 animate-pulse rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-6 max-w-lg mx-auto mt-16 text-center">
          <div className="surface rounded-xl border p-10">
            <div className="text-5xl mb-4 opacity-50">✦</div>
            <h2 className="text-xl font-bold text-default mb-2">Kaivor AI no disponible</h2>
            <p className="text-soft mb-6 text-sm">{error}</p>
            <Link
              href="/pricing"
              className="inline-block bg-brand text-ink-900 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-300 transition-colors"
            >
              Ver planes con IA →
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-default">Kaivor AI</h1>
          <p className="text-sm text-soft mt-0.5">Análisis automático de tu operación</p>
        </div>

        {summary && (
          <div className="surface rounded-xl border p-6 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-default">Resumen — {summary.period}</h2>
              <span className="text-xs text-ink-900 px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: 'rgba(163,204,57,0.18)' }}>IA</span>
            </div>
            <p className="text-sm text-soft mb-6 leading-relaxed">{summary.summary}</p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 rounded-xl" style={{ backgroundColor: 'rgba(163,204,57,0.10)' }}>
                <div className="text-2xl font-bold text-brand">
                  ${summary.totalRevenue.toLocaleString('es-CO')}
                </div>
                <div className="text-xs text-soft mt-1">Ingresos del mes</div>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-xl">
                <div className="text-2xl font-bold text-emerald-700">{summary.totalInvoices}</div>
                <div className="text-xs text-soft mt-1">Facturas emitidas</div>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-xl">
                <div className="text-2xl font-bold text-amber-700">{summary.pendingInvoices}</div>
                <div className="text-xs text-soft mt-1">Pendientes de cobro</div>
              </div>
            </div>

            {summary.topCustomers.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-medium text-soft uppercase tracking-wide mb-3">Top clientes</h3>
                <div className="space-y-2">
                  {summary.topCustomers.map((c, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full text-ink-900 text-xs flex items-center justify-center font-bold flex-shrink-0" style={{ backgroundColor: 'rgba(163,204,57,0.20)' }}>
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-default font-medium">{c.name}</span>
                          <span className="text-soft text-xs">{c.percentage}%</span>
                        </div>
                        <div className="h-1.5 surface-2 rounded-full">
                          <div className="h-1.5 bg-brand rounded-full" style={{ width: `${c.percentage}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary.topProduct !== 'Sin datos' && (
              <p className="text-xs text-soft">
                Producto estrella: <span className="font-medium text-default">{summary.topProduct}</span>
              </p>
            )}
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="surface rounded-xl border p-6">
            <h2 className="text-base font-semibold text-default mb-4">Recomendaciones</h2>
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div key={i} className={`border-l-4 p-4 rounded-r-lg ${priorityColor[rec.priority] ?? 'border-default surface-2'}`}>
                  <h3 className="font-medium text-default mb-1 text-sm">{rec.title}</h3>
                  <p className="text-sm text-soft">{rec.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
