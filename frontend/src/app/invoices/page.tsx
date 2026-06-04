'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import LoadError from '@/components/LoadError';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  invoiceDate: string;
  customer?: { name: string };
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Borrador',  cls: 'bg-slate-100 text-slate-600' },
  sent:      { label: 'Enviada',   cls: 'bg-blue-100 text-blue-700' },
  accepted:  { label: 'Aceptada',  cls: 'bg-emerald-100 text-emerald-700' },
  rejected:  { label: 'Rechazada', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-400' },
  pending_validation: { label: 'Pendiente validación', cls: 'bg-amber-100 text-amber-700' },
};

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<{ totalRevenue: number; totalInvoices: number; pendingInvoices: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    const headers = { Authorization: `Bearer ${token}` };
    setLoading(true);
    setLoadError(false);
    Promise.allSettled([
      axios.get(`${API}/invoices`, { headers }),
      axios.get(`${API}/invoices/stats`, { headers }),
    ]).then(([invRes, statsRes]) => {
      if (invRes.status === 'fulfilled') setInvoices(invRes.value.data);
      else setLoadError(true);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [router]);

  const filtered = filter === 'all' ? invoices : invoices.filter((i) => i.status === filter);

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-default">Facturas</h1>
            <p className="text-sm text-soft mt-0.5">Gestiona todas tus facturas electrónicas</p>
          </div>
          <Link
            href="/invoices/create"
            className="bg-ink-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-ink-700 transition-colors"
          >
            + Nueva factura
          </Link>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="surface rounded-xl border p-4">
              <p className="text-xs text-soft uppercase tracking-wide mb-1">Ingresos del mes</p>
              <p className="text-xl font-bold text-default">${stats.totalRevenue.toLocaleString('es-CO')}</p>
            </div>
            <div className="surface rounded-xl border p-4">
              <p className="text-xs text-soft uppercase tracking-wide mb-1">Facturas emitidas</p>
              <p className="text-xl font-bold text-default">{stats.totalInvoices}</p>
            </div>
            <div className="surface rounded-xl border p-4">
              <p className="text-xs text-soft uppercase tracking-wide mb-1">Pendientes de cobro</p>
              <p className="text-xl font-bold text-amber-600">{stats.pendingInvoices}</p>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 surface-2 rounded-xl p-1 w-fit">
          {['all', 'draft', 'sent', 'accepted'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? 'surface text-default shadow-sm' : 'text-soft hover:text-default'
              }`}
            >
              {f === 'all' ? 'Todas' : STATUS_CONFIG[f]?.label ?? f}
            </button>
          ))}
        </div>

        {/* Table / List */}
        {loadError ? (
          <LoadError onRetry={load} />
        ) : (
        <div className="surface rounded-xl border overflow-hidden">
          {loading ? (
            <div className="space-y-px">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 surface-2 animate-pulse border-b border-default" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="text-4xl mb-3 opacity-30">◻</div>
              <p className="text-default font-medium mb-1">
                {filter === 'all' ? 'Aún no tienes facturas' : `No hay facturas en estado "${STATUS_CONFIG[filter]?.label}"`}
              </p>
              <p className="text-sm text-soft mb-4">
                {filter === 'all' ? 'Crea tu primera factura en menos de 2 minutos.' : 'Prueba con otro filtro.'}
              </p>
              {filter === 'all' && (
                <Link
                  href="/invoices/create"
                  className="inline-block bg-ink-900 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-ink-700 transition-colors"
                >
                  Crear primera factura →
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="surface-2 border-b border-default">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-soft uppercase tracking-wide">N° Factura</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-soft uppercase tracking-wide hidden sm:table-cell">Cliente</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-soft uppercase tracking-wide">Estado</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-soft uppercase tracking-wide">Total</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-soft uppercase tracking-wide hidden md:table-cell">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {filtered.map((inv) => {
                  const s = STATUS_CONFIG[inv.status] ?? { label: inv.status, cls: 'bg-slate-100 text-slate-500' };
                  return (
                    <tr key={inv.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => router.push(`/invoices/${inv.id}`)}>
                      <td className="px-5 py-3.5 text-sm font-medium text-brand hover:underline">{inv.invoiceNumber}</td>
                      <td className="px-5 py-3.5 text-sm text-soft hidden sm:table-cell">
                        {inv.customer?.name ?? '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-default text-right">
                        ${inv.total.toLocaleString('es-CO')}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-soft hidden md:table-cell">
                        {new Date(inv.invoiceDate).toLocaleDateString('es-CO')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        )}
      </div>
    </AppLayout>
  );
}
