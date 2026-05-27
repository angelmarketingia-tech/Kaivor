'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

const TYPES: Record<string, string> = {
  payroll_due: 'Nómina pendiente', advance: 'Anticipo', loan: 'Préstamo',
  bonus: 'Bonificación', deduction: 'Deducción', reimbursement: 'Reembolso', other: 'Otro',
};

export default function PendingBalancesPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employeeId: '', type: 'advance', amount: '', dueDate: '', notes: '' });
  const [toast, setToast] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    axios.get(`${API}/hr/balances`, { headers })
      .then(r => setData(r.data))
      .catch(err => { if (err.response?.status === 403) setLocked(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    load();
    axios.get(`${API}/hr/employees`, { headers }).then(r => setEmployees(r.data)).catch(() => {});
  }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const create = async () => {
    if (!form.employeeId || !form.amount) { showToast('Selecciona empleado y monto'); return; }
    try {
      await axios.post(`${API}/hr/balances`, form, { headers });
      showToast('Saldo registrado');
      setShowForm(false); setForm({ employeeId: '', type: 'advance', amount: '', dueDate: '', notes: '' });
      load();
    } catch (e: any) { showToast(e.response?.data?.message || 'No se pudo crear'); }
  };

  const mark = async (id: string, status: string) => {
    try { await axios.patch(`${API}/hr/balances`, { id, status }, { headers }); load(); showToast('Saldo actualizado'); }
    catch { showToast('No se pudo actualizar'); }
  };

  if (loading) return (
    <AppLayout><div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div></AppLayout>
  );
  if (locked) return (
    <AppLayout><div className="p-6 max-w-md mx-auto mt-16 text-center">
      <div className="bg-white rounded-xl border border-violet-200 p-8">
        <div className="text-4xl mb-3">🏢</div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">RRHH es un módulo Business</h2>
        <Link href="/pricing" className="inline-block bg-violet-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium mt-3">Ver planes →</Link>
      </div>
    </div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {toast && <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">{toast}</div>}

        <div className="flex items-center gap-2 mb-4 text-sm">
          <Link href="/hr" className="text-slate-500 hover:text-slate-900">RRHH</Link>
          <span className="text-slate-300">/</span><span className="text-slate-900 font-medium">Saldos pendientes</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Saldos pendientes</h1>
            {data?.summary && <p className="text-sm text-slate-500">{data.summary.pendingCount} pendiente(s) · {fmt(data.summary.pendingAmount)}</p>}
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700">
            {showForm ? 'Cancelar' : '+ Registrar saldo'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Empleado</label>
                <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecciona…</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Tipo</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Monto</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Fecha límite (opcional)</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <button onClick={create} className="mt-3 bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
              Registrar
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {!data || data.balances.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-2 opacity-30">⏳</div>
              <p className="text-sm text-slate-500">Sin saldos registrados.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.balances.map((b: any) => (
                <div key={b.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{b.employee.firstName} {b.employee.lastName}</p>
                    <p className="text-xs text-slate-400">{TYPES[b.type] ?? b.type}{b.notes ? ` · ${b.notes}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${b.status === 'pending' ? 'text-amber-600' : 'text-slate-400'}`}>{fmt(b.amount)}</span>
                    {b.status === 'pending' ? (
                      <>
                        <button onClick={() => mark(b.id, 'paid')} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-100">Pagado</button>
                        <button onClick={() => mark(b.id, 'cancelled')} className="text-xs text-slate-400 hover:text-red-500">✕</button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">{b.status === 'paid' ? 'Pagado' : 'Cancelado'}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
