'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';
import LoadError from '@/components/LoadError';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

interface Supplier {
  id: string; name: string; category?: string; phone?: string;
  email?: string; status: string; outstandingBalance: number;
}

const EMPTY = { name: '', taxId: '', contactName: '', email: '', phone: '', city: '', category: '' };

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    setLoading(true);
    setLoadError(false);
    axios.get(`${API}/suppliers`, { headers })
      .then(r => setSuppliers(r.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (!token) { router.push('/auth/login'); return; } load(); }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const create = async () => {
    if (!form.name.trim()) { showToast('El nombre es requerido'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/suppliers`, form, { headers });
      showToast('Proveedor creado');
      setShowForm(false); setForm(EMPTY);
      load();
    } catch (e: any) { showToast(e.response?.data?.message || 'No se pudo crear'); }
    finally { setSaving(false); }
  };

  const filtered = suppliers.filter(s =>
    `${s.name} ${s.category || ''}`.toLowerCase().includes(search.toLowerCase()));
  const totalDue = suppliers.reduce((s, x) => s + x.outstandingBalance, 0);

  if (loading) return (
    <AppLayout><div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-default border-t-brand rounded-full animate-spin" />
    </div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto app-bg">
        {toast && <div className="fixed top-4 right-4 z-50 bg-ink-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">{toast}</div>}

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-default">Proveedores</h1>
            <p className="text-sm text-soft">{suppliers.length} proveedor(es){totalDue > 0 ? ` · ${fmt(totalDue)} por pagar` : ''}</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="bg-ink-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-ink-700">
            {showForm ? 'Cancelar' : '+ Nuevo proveedor'}
          </button>
        </div>

        {showForm && (
          <div className="surface rounded-xl border p-5 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([['name', 'Nombre *'], ['taxId', 'NIT'], ['contactName', 'Contacto'],
                ['email', 'Email'], ['phone', 'Teléfono'], ['city', 'Ciudad'], ['category', 'Categoría']] as const).map(([k, label]) => (
                <div key={k}>
                  <label className="text-xs text-soft block mb-1">{label}</label>
                  <input type="text" value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    className="w-full surface border rounded-lg px-3 py-2 text-sm text-default" />
                </div>
              ))}
            </div>
            <button onClick={create} disabled={saving}
              className="mt-3 bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'Guardando…' : 'Crear proveedor'}
            </button>
          </div>
        )}

        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar proveedor…" className="w-full surface border rounded-lg px-3 py-2 text-sm text-default mb-4" />

        {loadError ? (
          <LoadError onRetry={load} />
        ) : (
        <div className="surface rounded-xl border overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-2 opacity-30">🏭</div>
              <p className="text-sm text-soft">{suppliers.length === 0 ? 'Sin proveedores aún.' : 'Sin resultados.'}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="surface-2 border-b border-default">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-soft uppercase">Proveedor</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-soft uppercase hidden sm:table-cell">Categoría</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-soft uppercase">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {filtered.map(s => (
                  <tr key={s.id} onClick={() => router.push(`/suppliers/${s.id}`)}
                    className="hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-brand hover:underline">{s.name}</p>
                      {s.phone && <p className="text-xs text-soft">{s.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-default hidden sm:table-cell">{s.category || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {s.outstandingBalance > 0
                        ? <span className="text-sm font-semibold text-amber-600">{fmt(s.outstandingBalance)}</span>
                        : <span className="text-xs text-soft">Al día</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        )}
      </div>
    </AppLayout>
  );
}
