'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';
import LoadError from '@/components/LoadError';
import { useToast } from '@/contexts/ToastContext';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  city?: string;
  createdAt: string;
}

const EMPTY_FORM = { name: '', email: '', phone: '', taxId: '', address: '', city: '' };

export default function CustomersPage() {
  const router = useRouter();
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    fetchCustomers(token);
  }, [router]);

  const fetchCustomers = async (token?: string) => {
    const t = token ?? localStorage.getItem('token');
    if (!t) return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await axios.get(`${API}/customers`, { headers: { Authorization: `Bearer ${t}` } });
      setCustomers(res.data);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre del cliente es requerido.'); return; }
    const token = localStorage.getItem('token');
    if (!token) return;
    setSaving(true);
    try {
      await axios.post(`${API}/customers`, form, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Cliente creado correctamente.');
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos crear el cliente. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = customers.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.taxId?.includes(search)
  );

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto app-bg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-default">Clientes</h1>
            <p className="text-sm text-soft mt-0.5">{customers.length} cliente{customers.length !== 1 ? 's' : ''} registrado{customers.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-ink-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-ink-700 transition-colors"
          >
            + Nuevo cliente
          </button>
        </div>

        {/* Create form slide-in */}
        {showForm && (
          <div className="surface rounded-xl border p-6 mb-6">
            <h2 className="text-base font-semibold text-default mb-4">Nuevo cliente</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-default mb-1">Nombre *</label>
                <input
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Empresa o persona" required
                  className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-default mb-1">NIT / Cédula</label>
                <input
                  value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                  placeholder="900123456-7"
                  className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-default mb-1">Correo</label>
                <input
                  type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contacto@empresa.com"
                  className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-default mb-1">Teléfono</label>
                <input
                  value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+57 300 000 0000"
                  className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-default mb-1">Ciudad</label>
                <input
                  value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Bogotá"
                  className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-default mb-1">Dirección</label>
                <input
                  value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Cra 7 # 10-20"
                  className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                  className="px-4 py-2 text-sm text-soft hover:text-default border border-default rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={saving}
                  className="px-5 py-2 bg-brand text-ink-900 rounded-lg text-sm font-semibold hover:bg-brand-300 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar cliente'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        {customers.length > 0 && (
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo o NIT..."
            className="w-full surface border rounded-xl px-4 py-2.5 text-sm text-default focus:outline-none focus:ring-2 ring-brand mb-4"
          />
        )}

        {/* List */}
        {loadError ? (
          <LoadError onRetry={() => fetchCustomers()} />
        ) : (
        <div className="surface rounded-xl border overflow-hidden">
          {loading ? (
            <div className="space-y-px">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 surface-2 animate-pulse border-b border-default" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="text-4xl mb-3 opacity-30">◉</div>
              <p className="text-default font-medium mb-1">
                {search ? 'No encontramos clientes con ese criterio.' : 'Aún no tienes clientes'}
              </p>
              <p className="text-sm text-soft mb-4">
                {!search && 'Agrega tu primer cliente para comenzar a facturar.'}
              </p>
              {!search && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-block bg-brand text-ink-900 px-5 py-2 rounded-xl text-sm font-semibold hover:bg-brand-300"
                >
                  Agregar primer cliente →
                </button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="surface-2 border-b border-default">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-soft uppercase tracking-wide">Nombre</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-soft uppercase tracking-wide hidden sm:table-cell">Correo</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-soft uppercase tracking-wide hidden md:table-cell">NIT / Cédula</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-soft uppercase tracking-wide hidden lg:table-cell">Ciudad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => router.push(`/customers/${c.id}`)}
                    className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-brand hover:underline">{c.name}</p>
                      {c.phone && <p className="text-xs text-soft">{c.phone}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-default hidden sm:table-cell">{c.email ?? '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-soft hidden md:table-cell">
                      {c.taxId ? (
                        <span>{c.taxId}</span>
                      ) : (
                        <span className="text-amber-500 text-xs">Sin documento fiscal</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-soft hidden lg:table-cell">{c.city ?? '—'}</td>
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
