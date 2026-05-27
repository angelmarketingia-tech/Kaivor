'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

interface Employee {
  id: string; firstName: string; lastName: string; position?: string;
  department?: string; salary: number; status: string; phone?: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Activo', cls: 'bg-emerald-100 text-emerald-700' },
  inactive: { label: 'Inactivo', cls: 'bg-slate-100 text-slate-500' },
  on_leave: { label: 'En licencia', cls: 'bg-amber-100 text-amber-700' },
  terminated: { label: 'Retirado', cls: 'bg-red-100 text-red-700' },
};

const EMPTY = { firstName: '', lastName: '', documentNumber: '', email: '', phone: '', position: '', department: '', salary: '', contractType: 'indefinido', startDate: '' };

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    axios.get(`${API}/hr/employees`, { headers })
      .then(r => setEmployees(r.data))
      .catch(err => { if (err.response?.status === 403) setLocked(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (!token) { router.push('/auth/login'); return; } load(); }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const create = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { showToast('Nombre y apellido requeridos'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/hr/employees`, form, { headers });
      showToast('Empleado creado');
      setShowForm(false); setForm(EMPTY);
      load();
    } catch (e: any) { showToast(e.response?.data?.message || 'No se pudo crear'); }
    finally { setSaving(false); }
  };

  const filtered = employees.filter(e =>
    `${e.firstName} ${e.lastName} ${e.department || ''} ${e.position || ''}`.toLowerCase().includes(search.toLowerCase()));

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
        <p className="text-sm text-slate-500 mb-5">Mejora tu plan para gestionar empleados y nómina.</p>
        <Link href="/pricing" className="inline-block bg-violet-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium">Ver planes →</Link>
      </div>
    </div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {toast && <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">{toast}</div>}

        <div className="flex items-center gap-2 mb-4 text-sm">
          <Link href="/hr" className="text-slate-500 hover:text-slate-900">RRHH</Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-medium">Empleados</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Empleados</h1>
          <button onClick={() => setShowForm(!showForm)}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700">
            {showForm ? 'Cancelar' : '+ Nuevo empleado'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([['firstName', 'Nombre *'], ['lastName', 'Apellido *'], ['documentNumber', 'Documento'],
                ['email', 'Email'], ['phone', 'Teléfono'], ['position', 'Cargo'], ['department', 'Área']] as const).map(([k, label]) => (
                <div key={k}>
                  <label className="text-xs text-slate-500 block mb-1">{label}</label>
                  <input type="text" value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
              <div>
                <label className="text-xs text-slate-500 block mb-1">Salario mensual</label>
                <input type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Tipo de contrato</label>
                <select value={form.contractType} onChange={e => setForm(f => ({ ...f, contractType: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="indefinido">Indefinido</option>
                  <option value="fijo">Término fijo</option>
                  <option value="prestacion">Prestación de servicios</option>
                  <option value="aprendizaje">Aprendizaje</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Fecha de ingreso</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <button onClick={create} disabled={saving}
              className="mt-3 bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'Guardando…' : 'Crear empleado'}
            </button>
          </div>
        )}

        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, área o cargo…"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4" />

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-2 opacity-30">👤</div>
              <p className="text-sm text-slate-500">{employees.length === 0 ? 'Sin empleados aún.' : 'Sin resultados.'}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Empleado</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Área</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Salario</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(e => {
                  const st = STATUS[e.status] ?? STATUS.active;
                  return (
                    <tr key={e.id} onClick={() => router.push(`/hr/employees/${e.id}`)}
                      className="hover:bg-slate-50 cursor-pointer">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-violet-700 hover:underline">{e.firstName} {e.lastName}</p>
                        {e.position && <p className="text-xs text-slate-400">{e.position}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 hidden sm:table-cell">{e.department || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right hidden sm:table-cell">{fmt(e.salary)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
