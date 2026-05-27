'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

const TYPES = [
  { v: 'sede', l: 'Sede' }, { v: 'sucursal', l: 'Sucursal' }, { v: 'marca', l: 'Marca' },
  { v: 'bodega', l: 'Bodega' }, { v: 'empresa', l: 'Empresa' }, { v: 'online', l: 'Tienda online' },
];
const TYPE_ICON: Record<string, string> = { sede: '🏢', sucursal: '🏬', marca: '🏷️', bodega: '📦', empresa: '🏛️', online: '🛒' };

export default function AccountsPage() {
  const router = useRouter();
  const [group, setGroup] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'sede' });
  const [active, setActive] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    axios.get(`${API}/accounts`, { headers })
      .then(r => { setGroup(r.data.group); setAccounts(r.data.accounts); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    setActive(localStorage.getItem('activeAccountId'));
    load();
  }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const create = async () => {
    if (!form.name.trim()) { showToast('El nombre es requerido'); return; }
    try {
      await axios.post(`${API}/accounts`, form, { headers });
      showToast('Cuenta creada');
      setShowForm(false); setForm({ name: '', type: 'sede' });
      load();
    } catch (e: any) { showToast(e.response?.data?.message || 'No se pudo crear'); }
  };

  const switchTo = async (a: any) => {
    try {
      await axios.post(`${API}/accounts/switch`, { accountId: a.id }, { headers });
      localStorage.setItem('activeAccountId', a.id);
      localStorage.setItem('activeAccountName', a.name);
      setActive(a.id);
      showToast(`Cuenta activa: ${a.name}`);
    } catch (e: any) { showToast(e.response?.data?.message || 'No se pudo cambiar'); }
  };

  if (loading) return (
    <AppLayout><div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {toast && <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">{toast}</div>}

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Cuentas</h1>
            <p className="text-sm text-slate-500">Sedes, sucursales y unidades de negocio.</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700">
            {showForm ? 'Cancelar' : '+ Nueva cuenta'}
          </button>
        </div>

        {/* Parent group */}
        {group && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-700 text-white rounded-xl p-5 mb-4">
            <p className="text-xs text-slate-300 uppercase tracking-wide">Cuenta padre</p>
            <p className="text-lg font-bold">{group.name}</p>
            <p className="text-xs text-slate-300 mt-1">{accounts.length} cuenta(s) hija(s) · vista consolidada</p>
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
            <label className="text-xs text-slate-500 block mb-1">Nombre de la cuenta</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Sede Bogotá" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3" />
            <label className="text-xs text-slate-500 block mb-1">Tipo</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
              {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <button onClick={create} className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
              Crear cuenta hija
            </button>
          </div>
        )}

        {/* Account tree */}
        <div className="space-y-2">
          {accounts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 text-center py-12">
              <div className="text-3xl mb-2 opacity-30">🏢</div>
              <p className="text-sm text-slate-500">Sin cuentas hijas. Crea sedes o sucursales para organizar tu empresa.</p>
            </div>
          ) : accounts.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
              <span className="text-2xl">{TYPE_ICON[a.type] ?? '🏢'}</span>
              <button onClick={() => router.push(`/accounts/${a.id}`)} className="flex-1 text-left">
                <p className="text-sm font-medium text-violet-700 hover:underline">{a.name}</p>
                <p className="text-xs text-slate-400 capitalize">{a.type} · {a.memberCount} usuario(s) · {a.status === 'active' ? 'activa' : 'inactiva'}</p>
              </button>
              {active === a.id ? (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">Activa</span>
              ) : (
                <button onClick={() => switchTo(a)} disabled={a.status !== 'active'}
                  className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40">
                  Usar cuenta
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 mt-4 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          La cuenta activa se usa como contexto de trabajo. La vista consolidada del grupo refleja toda la operación de la empresa.
        </p>
      </div>
    </AppLayout>
  );
}
