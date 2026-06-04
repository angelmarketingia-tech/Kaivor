'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';
import LoadError from '@/components/LoadError';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Alert {
  type: string; severity: string;
  productId: string; productName: string; sku: string;
  quantity: number; reorderPoint: number; message: string;
}

const SUGGESTED = [
  '¿Qué productos tienen stock bajo?',
  '¿Qué productos debo reponer?',
  '¿Cuáles son mis productos más vendidos?',
  '¿Qué productos están sin stock?',
];

export default function InventoryPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; teaser: boolean } | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    setLoading(true);
    setLoadError(false);
    axios.get(`${API}/inventory/alerts`, { headers })
      .then(r => { setAlerts(r.data.alerts); setSummary(r.data.summary); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    load();
  }, []);

  const ask = async (q?: string) => {
    const query = q ?? question;
    if (!query.trim()) return;
    setQuestion(query);
    setAsking(true);
    setAnswer(null);
    try {
      const res = await axios.post(`${API}/inventory/ask`, { question: query }, { headers });
      setAnswer({ text: res.data.answer, teaser: !!res.data.teaser });
    } catch {
      setAnswer({ text: 'No pudimos procesar tu pregunta. Intenta de nuevo.', teaser: false });
    } finally { setAsking(false); }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-default">Inventario</h1>
          <p className="text-sm text-soft mt-0.5">Alertas de stock y consultas inteligentes.</p>
        </div>

        {/* AI ask */}
        <div className="rounded-xl border p-5 mb-5" style={{ background: 'linear-gradient(135deg, rgba(163,204,57,0.12), rgba(11,18,32,0.04))', borderColor: 'rgba(163,204,57,0.22)' }}>
          <h2 className="text-sm font-semibold text-brand mb-2">✦ Preguntar a Kaivor AI</h2>
          <div className="flex gap-2 mb-3">
            <input type="text" value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ask()}
              placeholder="Ej: ¿qué productos debo reponer?"
              className="flex-1 surface border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand" />
            <button onClick={() => ask()} disabled={asking || !question.trim()}
              className="bg-brand text-ink-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-300 disabled:opacity-40">
              {asking ? '…' : 'Preguntar'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED.map(s => (
              <button key={s} onClick={() => ask(s)}
                className="text-xs surface text-brand border px-2.5 py-1 rounded-full hover:bg-[var(--surface-2)]">
                {s}
              </button>
            ))}
          </div>
          {answer && (
            <div className={`mt-3 rounded-lg px-4 py-3 ${answer.teaser ? 'bg-amber-50 border border-amber-100' : 'surface border'}`}>
              <p className={`text-sm ${answer.teaser ? 'text-amber-800' : 'text-default'} leading-relaxed`}>{answer.text}</p>
              {answer.teaser && (
                <Link href="/pricing" className="text-xs text-brand font-medium hover:underline mt-1 inline-block">
                  Ver planes con IA →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Alerts */}
        {loadError ? (
          <LoadError onRetry={load} />
        ) : loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 surface-2 animate-pulse rounded-xl" />)}
          </div>
        ) : (
          <>
            {summary && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="surface rounded-xl border p-3 text-center">
                  <p className="text-lg font-bold text-red-600">{summary.outOfStock}</p>
                  <p className="text-xs text-soft">Sin stock</p>
                </div>
                <div className="surface rounded-xl border p-3 text-center">
                  <p className="text-lg font-bold text-amber-600">{summary.lowStock}</p>
                  <p className="text-xs text-soft">Stock bajo</p>
                </div>
                <div className="surface rounded-xl border p-3 text-center">
                  <p className="text-lg font-bold text-default">{summary.trackedProducts}</p>
                  <p className="text-xs text-soft">Productos seguidos</p>
                </div>
              </div>
            )}

            <div className="surface rounded-xl border overflow-hidden">
              <div className="px-5 py-3 border-b border-default">
                <h2 className="text-sm font-semibold text-default">Alertas de inventario</h2>
              </div>
              {alerts.length === 0 ? (
                <div className="text-center py-10 px-6">
                  <div className="text-3xl mb-2">✓</div>
                  <p className="text-sm text-default font-medium">Todo en orden</p>
                  <p className="text-xs text-soft mt-0.5">
                    {summary?.trackedProducts === 0
                      ? 'Aún no hay productos con inventario. Configúralo desde el detalle de cada producto.'
                      : 'Ningún producto tiene stock bajo o agotado.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {alerts.map((a, i) => (
                    <Link key={i} href={`/products/${a.productId}`}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--surface-2)]">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${a.severity === 'high' ? 'bg-red-500' : 'bg-amber-500'}`} />
                        <div>
                          <p className="text-sm font-medium text-default">{a.productName}</p>
                          <p className="text-xs text-soft">{a.message}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.type === 'out_of_stock' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {a.quantity} und
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
