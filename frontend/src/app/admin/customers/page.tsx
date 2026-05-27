'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '@/components/AdminShell';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-CO', { dateStyle: 'medium' } as any);

interface Row {
  id: string; name: string; slug: string; isActive: boolean;
  plan: string; subStatus: string; users: number; invoices: number; createdAt: string;
}

const PLANS = ['FREE', 'STARTER', 'PRO_AI', 'BUSINESS', 'ENTERPRISE'];

export default function AdminCustomers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selected, setSelected] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    setLoading(true); setError(false);
    axios.get(`${API}/admin/customers${filter !== 'all' ? `?filter=${filter}` : ''}`, { headers })
      .then(r => setRows(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filter]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const act = async (action: string, plan?: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await axios.patch(`${API}/admin/customers/${selected.id}`, { action, plan }, { headers });
      showToast(action === 'change-plan' ? `Plan cambiado a ${plan}` : action === 'suspend' ? 'Empresa suspendida' : 'Empresa reactivada');
      setSelected(null);
      load();
    } catch { showToast('No se pudo completar la acción'); }
    finally { setBusy(false); }
  };

  return (
    <AdminShell>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        {toast && <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">{toast}</div>}
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Clientes de Kaivor</h1>
        <p className="text-sm text-slate-500 mb-5">Todas las empresas registradas en la plataforma.</p>

        <div className="flex gap-1 mb-4 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === f ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
              {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : 'Inactivas'}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-50 animate-pulse rounded" />)}</div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-600 mb-3">No pudimos cargar los clientes.</p>
              <button onClick={load} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Reintentar</button>
            </div>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-slate-400 text-sm">Sin empresas.</p>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Empresa</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Plan</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Usuarios</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Facturas</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Registro</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => (
                  <tr key={r.id} onClick={() => setSelected(r)} className="hover:bg-slate-50 cursor-pointer">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{r.name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">{r.plan.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-slate-600 hidden sm:table-cell">{r.users}</td>
                    <td className="px-4 py-3 text-sm text-center text-slate-600 hidden sm:table-cell">{r.invoices}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 hidden md:table-cell">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {r.isActive ? 'Activa' : 'Suspendida'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail modal */}
        {selected && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
            <div className="bg-white rounded-xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-slate-900">{selected.name}</h3>
              <p className="text-xs text-slate-400 mb-4">{selected.slug} · {selected.users} usuario(s) · {selected.invoices} factura(s)</p>

              <p className="text-xs text-slate-500 mb-1">Cambiar plan</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {PLANS.map(p => (
                  <button key={p} onClick={() => act('change-plan', p)} disabled={busy || p === selected.plan}
                    className={`text-xs px-2.5 py-1 rounded-lg border ${p === selected.plan ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 hover:bg-slate-50'} disabled:opacity-60`}>
                    {p.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                {selected.isActive ? (
                  <button onClick={() => act('suspend')} disabled={busy}
                    className="flex-1 bg-red-50 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50">
                    Suspender empresa
                  </button>
                ) : (
                  <button onClick={() => act('reactivate')} disabled={busy}
                    className="flex-1 bg-emerald-50 text-emerald-600 py-2 rounded-lg text-sm font-medium hover:bg-emerald-100 disabled:opacity-50">
                    Reactivar empresa
                  </button>
                )}
                <button onClick={() => setSelected(null)}
                  className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
