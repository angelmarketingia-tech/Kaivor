'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-CO', { dateStyle: 'medium' } as any);

const ST: Record<string, { l: string; c: string }> = {
  draft: { l: 'Borrador', c: 'surface-2 text-soft' },
  calculated: { l: 'Calculada', c: 'bg-blue-100 text-blue-700' },
  approved: { l: 'Aprobada', c: 'bg-brand-100 text-brand-700' },
  paid: { l: 'Pagada', c: 'bg-emerald-100 text-emerald-700' },
  partially_paid: { l: 'Pago parcial', c: 'bg-amber-100 text-amber-700' },
  cancelled: { l: 'Cancelada', c: 'bg-red-100 text-red-700' },
};

export default function PayrollPage() {
  const router = useRouter();
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', paymentDate: '', includeAllActive: true });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    axios.get(`${API}/hr/payroll`, { headers })
      .then(r => setPeriods(r.data))
      .catch(err => { if (err.response?.status === 403) setLocked(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (!token) { router.push('/auth/login'); return; } load(); }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const create = async () => {
    if (!form.name.trim() || !form.startDate || !form.endDate) { showToast('Completa nombre y fechas'); return; }
    setSaving(true);
    try {
      const res = await axios.post(`${API}/hr/payroll`, form, { headers });
      showToast('Periodo creado');
      router.push(`/hr/payroll/${res.data.id}`);
    } catch (e: any) { showToast(e.response?.data?.message || 'No se pudo crear'); setSaving(false); }
  };

  if (loading) return (
    <AppLayout><div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div></AppLayout>
  );
  if (locked) return (
    <AppLayout><div className="p-6 max-w-md mx-auto mt-16 text-center">
      <div className="surface rounded-xl border p-8">
        <div className="text-4xl mb-3">🏢</div>
        <h2 className="text-lg font-bold text-default mb-1">Nómina es un módulo Business</h2>
        <Link href="/pricing" className="inline-block bg-brand text-ink-900 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-300 mt-3">Ver planes →</Link>
      </div>
    </div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {toast && <div className="fixed top-4 right-4 z-50 bg-ink-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">{toast}</div>}

        <div className="flex items-center gap-2 mb-4 text-sm">
          <Link href="/hr" className="text-soft hover:text-default">RRHH</Link>
          <span className="text-soft">/</span><span className="text-default font-medium">Nómina</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-default">Nómina</h1>
          <button onClick={() => setShowForm(!showForm)}
            className="bg-ink-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-ink-700">
            {showForm ? 'Cancelar' : '+ Nuevo periodo'}
          </button>
        </div>

        {showForm && (
          <div className="surface rounded-xl border p-5 mb-4">
            <label className="text-xs text-soft block mb-1">Nombre del periodo</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Quincena 1 - Mayo 2026" className="w-full border border-default rounded-lg px-3 py-2 text-sm mb-3 bg-transparent text-default" />
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div><label className="text-xs text-soft block mb-1">Inicio</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full border border-default rounded-lg px-2 py-2 text-sm bg-transparent text-default" /></div>
              <div><label className="text-xs text-soft block mb-1">Fin</label>
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full border border-default rounded-lg px-2 py-2 text-sm bg-transparent text-default" /></div>
              <div><label className="text-xs text-soft block mb-1">Pago</label>
                <input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                  className="w-full border border-default rounded-lg px-2 py-2 text-sm bg-transparent text-default" /></div>
            </div>
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input type="checkbox" checked={form.includeAllActive} onChange={e => setForm(f => ({ ...f, includeAllActive: e.target.checked }))}
                className="rounded border-slate-300 text-brand" />
              <span className="text-sm text-default">Incluir a todos los empleados activos</span>
            </label>
            <button onClick={create} disabled={saving}
              className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'Creando…' : 'Crear periodo'}
            </button>
          </div>
        )}

        <div className="surface rounded-xl border overflow-hidden">
          {periods.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-2 opacity-30">💵</div>
              <p className="text-sm text-soft">Sin periodos de nómina aún.</p>
            </div>
          ) : (
            <div className="divide-y divide-default">
              {periods.map(p => {
                const st = ST[p.status] ?? ST.draft;
                return (
                  <Link key={p.id} href={`/hr/payroll/${p.id}`} className="flex items-center justify-between px-4 py-3 hover-surface-2">
                    <div>
                      <p className="text-sm font-medium text-brand">{p.name}</p>
                      <p className="text-xs text-soft">{fmtDate(p.startDate)} – {fmtDate(p.endDate)} · {p.itemCount} empleado(s)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-default">{fmt(p.totalNet)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${st.c}`}>{st.l}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
