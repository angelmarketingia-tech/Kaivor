'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('es-CO', { dateStyle: 'medium' } as any) : '—';

const STATUSES = [
  { v: 'active', l: 'Activo' }, { v: 'on_leave', l: 'En licencia' },
  { v: 'inactive', l: 'Inactivo' }, { v: 'terminated', l: 'Retirado' },
];

export default function EmployeeDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ kind: string; msg: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [toast, setToast] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!token) { router.push('/auth/login'); return; }
    setLoading(true); setError(null);
    try {
      const res = await axios.get(`${API}/hr/employees/${id}`, { headers });
      setData(res.data);
      setForm(res.data.employee);
    } catch (err: any) {
      const s = err?.response?.status;
      if (s === 401) { router.push('/auth/login'); return; }
      if (s === 404) setError({ kind: 'notfound', msg: 'Este empleado no existe.' });
      else setError({ kind: 'fail', msg: 'No pudimos cargar el empleado.' });
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const save = async () => {
    try {
      await axios.patch(`${API}/hr/employees/${id}`, {
        firstName: form.firstName, lastName: form.lastName, position: form.position,
        department: form.department, email: form.email, phone: form.phone,
        salary: form.salary, status: form.status, contractType: form.contractType, notes: form.notes,
      }, { headers });
      showToast('Cambios guardados'); setEditing(false); load();
    } catch { showToast('No se pudo guardar'); }
  };

  if (loading) return (
    <AppLayout><div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div></AppLayout>
  );
  if (error) return (
    <AppLayout><div className="p-6 max-w-md mx-auto mt-16 text-center">
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <div className="text-4xl mb-3">{error.kind === 'notfound' ? '🔍' : '⚠️'}</div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">{error.msg}</h2>
        <div className="flex gap-2 justify-center mt-4">
          {error.kind === 'fail' && <button onClick={load} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Reintentar</button>}
          <Link href="/hr/employees" className="border border-slate-200 px-4 py-2 rounded-lg text-sm">Volver</Link>
        </div>
      </div>
    </div></AppLayout>
  );
  if (!data) return null;

  const e = data.employee;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {toast && <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">{toast}</div>}

        <div className="flex items-center gap-2 mb-4 text-sm">
          <Link href="/hr/employees" className="text-slate-500 hover:text-slate-900">Empleados</Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-medium">{e.firstName} {e.lastName}</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{e.firstName} {e.lastName}</h1>
              <p className="text-sm text-slate-500">{e.position || 'Sin cargo'} · {e.department || 'Sin área'}</p>
            </div>
            <button onClick={() => { setEditing(!editing); setForm(e); }}
              className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200">
              {editing ? 'Cancelar' : 'Editar'}
            </button>
          </div>

          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {([['firstName', 'Nombre'], ['lastName', 'Apellido'], ['position', 'Cargo'], ['department', 'Área'],
                ['email', 'Email'], ['phone', 'Teléfono']] as const).map(([k, label]) => (
                <div key={k}>
                  <label className="text-xs text-slate-500 block mb-1">{label}</label>
                  <input type="text" value={form[k] || ''} onChange={ev => setForm((f: any) => ({ ...f, [k]: ev.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
              <div>
                <label className="text-xs text-slate-500 block mb-1">Salario</label>
                <input type="number" value={form.salary || 0} onChange={ev => setForm((f: any) => ({ ...f, salary: ev.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Estado</label>
                <select value={form.status} onChange={ev => setForm((f: any) => ({ ...f, status: ev.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {STATUSES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <button onClick={save} className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
                  Guardar cambios
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div><p className="text-xs text-slate-400">Salario</p><p className="text-sm font-medium text-slate-900">{fmt(e.salary)}</p></div>
              <div><p className="text-xs text-slate-400">Documento</p><p className="text-sm text-slate-700">{e.documentNumber || '—'}</p></div>
              <div><p className="text-xs text-slate-400">Teléfono</p><p className="text-sm text-slate-700">{e.phone || '—'}</p></div>
              <div><p className="text-xs text-slate-400">Ingreso</p><p className="text-sm text-slate-700">{fmtDate(e.startDate)}</p></div>
              <div><p className="text-xs text-slate-400">Contrato</p><p className="text-sm text-slate-700">{e.contractType || '—'}</p></div>
              <div><p className="text-xs text-slate-400">Email</p><p className="text-sm text-slate-700 truncate">{e.email || '—'}</p></div>
            </div>
          )}
        </div>

        {/* Saldos */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-slate-100 flex justify-between">
            <span className="text-sm font-semibold text-slate-700">Saldos pendientes</span>
            <span className="text-sm font-bold text-amber-600">{fmt(data.pendingBalance)}</span>
          </div>
          {data.balances.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">Sin saldos registrados.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.balances.map((b: any) => (
                <div key={b.id} className="px-5 py-2.5 flex justify-between text-sm">
                  <span className="text-slate-600">{b.type}</span>
                  <span className={b.status === 'pending' ? 'text-amber-600 font-medium' : 'text-slate-400'}>{fmt(b.amount)} · {b.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nómina */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Historial de nómina</span>
          </div>
          {data.payrollItems.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">Sin registros de nómina.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.payrollItems.map((it: any) => (
                <div key={it.id} className="px-5 py-2.5 flex justify-between text-sm">
                  <span className="text-slate-600">{it.period?.name}</span>
                  <span className="text-slate-900 font-medium">{fmt(it.netPay)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
