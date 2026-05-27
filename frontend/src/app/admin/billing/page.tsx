'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '@/components/AdminShell';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-CO', { dateStyle: 'medium' } as any);

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700', overdue: 'bg-red-100 text-red-700',
  paid: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-slate-100 text-slate-500',
};
const PLAN_PRICE: Record<string, number> = { STARTER: 49000, PRO_AI: 99000, BUSINESS: 199000, ENTERPRISE: 499000 };

export default function AdminBilling() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [form, setForm] = useState({ tenantId: '', plan: 'PRO_AI', amount: '99000', notes: '' });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    setLoading(true); setFailed(false);
    axios.get(`${API}/admin/billing`, { headers })
      .then(r => setData(r.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    axios.get(`${API}/admin/customers`, { headers }).then(r => setTenants(r.data)).catch(() => {});
  }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const create = async () => {
    if (!form.tenantId || !form.amount) { showToast('Selecciona empresa y monto'); return; }
    try {
      await axios.post(`${API}/admin/billing`, { ...form, amount: Number(form.amount) }, { headers });
      showToast('Cobro de membresía creado');
      setCreating(false);
      load();
    } catch { showToast('No se pudo crear el cobro'); }
  };

  const action = async (id: string, act: string) => {
    try {
      const res = await axios.patch(`${API}/admin/billing`, { id, action: act }, { headers });
      if (act === 'send-reminder') {
        if (res.data.waUrl) { window.open(res.data.waUrl, '_blank'); showToast('WhatsApp abierto con el recordatorio'); }
        else showToast(res.data.message || 'Sin teléfono registrado');
      } else {
        showToast(act === 'mark-paid' ? 'Cobro marcado como pagado' : 'Cobro cancelado');
        load();
      }
    } catch { showToast('No se pudo completar la acción'); }
  };

  return (
    <AdminShell>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {toast && <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">{toast}</div>}

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Membresías y cobros</h1>
            <p className="text-sm text-slate-500">Gestión operativa de suscripciones de Kaivor.</p>
          </div>
          <button onClick={() => setCreating(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700">
            + Crear cobro
          </button>
        </div>

        {data?.summary && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-lg font-bold text-amber-600">{data.summary.pending}</p><p className="text-xs text-slate-500">Pendientes</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-lg font-bold text-red-600">{data.summary.overdue}</p><p className="text-xs text-slate-500">Vencidos</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-lg font-bold text-emerald-600">{data.summary.paid}</p><p className="text-xs text-slate-500">Pagados</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-lg font-bold text-slate-900">{fmt(data.summary.totalPending)}</p><p className="text-xs text-slate-500">Por cobrar</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-slate-50 animate-pulse rounded" />)}</div>
          ) : failed ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-600 mb-3">No pudimos cargar las membresías.</p>
              <button onClick={load} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Reintentar</button>
            </div>
          ) : data.memberships.length === 0 ? (
            <p className="p-10 text-center text-slate-400 text-sm">Sin cobros de membresía. Crea el primero.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.memberships.map((m: any) => (
                <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{m.tenantName}</p>
                    <p className="text-xs text-slate-400">{m.plan} · vence {fmtDate(m.dueDate)}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{fmt(m.amount)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[m.status]}`}>{m.status}</span>
                  {m.status !== 'paid' && m.status !== 'cancelled' && (
                    <div className="flex gap-1">
                      <button onClick={() => action(m.id, 'send-reminder')} title="Recordar por WhatsApp"
                        className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100">Recordar</button>
                      <button onClick={() => action(m.id, 'mark-paid')}
                        className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-100">Pagado</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {creating && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setCreating(false)}>
            <div className="bg-white rounded-xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Crear cobro de membresía</h3>
              <label className="text-xs text-slate-500 block mb-1">Empresa</label>
              <select value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
                <option value="">Selecciona…</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <label className="text-xs text-slate-500 block mb-1">Plan</label>
              <select value={form.plan}
                onChange={e => setForm(f => ({ ...f, plan: e.target.value, amount: String(PLAN_PRICE[e.target.value] ?? f.amount) }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
                {['STARTER', 'PRO_AI', 'BUSINESS', 'ENTERPRISE'].map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
              </select>
              <label className="text-xs text-slate-500 block mb-1">Monto (COP)</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3" />
              <div className="flex gap-2">
                <button onClick={create} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">Crear cobro</button>
                <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600">Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
