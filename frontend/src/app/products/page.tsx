'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';
import LoadError from '@/components/LoadError';
import { useToast } from '@/contexts/ToastContext';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  category?: string;
  unit?: string;
  isActive: boolean;
  createdAt: string;
}

const EMPTY_FORM = { name: '', sku: '', price: '', category: '', unit: 'u', cost: '', type: 'product', durationMin: '' };

export default function ProductsPage() {
  const router = useRouter();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('u');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    fetchProducts(token);
    axios.get(`${API}/companies/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const u = res.data?.vertical?.defaults?.unit;
        if (u && typeof u === 'string') {
          setDefaultUnit(u);
          setForm((f) => (f.unit === 'u' ? { ...f, unit: u } : f));
        }
      })
      .catch(() => {});
  }, [router]);

  const fetchProducts = async (token?: string) => {
    const t = token ?? localStorage.getItem('token');
    if (!t) return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await axios.get(`${API}/products`, { headers: { Authorization: `Bearer ${t}` } });
      setProducts(res.data);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre del producto es requerido.'); return; }
    if (!form.price || isNaN(Number(form.price))) { toast.error('El precio debe ser un número válido.'); return; }
    const token = localStorage.getItem('token');
    if (!token) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku || `SKU-${Date.now()}`,
        price: parseFloat(form.price),
        category: form.category || undefined,
        unit: form.unit,
        cost: form.cost ? parseFloat(form.cost) : undefined,
        type: form.type,
        durationMin: form.type === 'service' && form.durationMin ? parseInt(form.durationMin, 10) : undefined,
      };
      await axios.post(`${API}/products`, payload, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Producto creado correctamente.');
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos crear el producto. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-default">Productos y servicios</h1>
            <p className="text-sm text-soft mt-0.5">{products.length} producto{products.length !== 1 ? 's' : ''} en catálogo</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-ink-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-ink-700 transition-colors"
          >
            + Nuevo producto
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="surface rounded-xl border p-6 mb-6">
            <h2 className="text-base font-semibold text-default mb-4">Nuevo producto o servicio</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-default mb-1">Tipo</label>
                <div className="inline-flex rounded-lg border border-default p-0.5 surface-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'product', unit: ['servicio', 'hora', 'sesión'].includes(form.unit) ? defaultUnit : form.unit, durationMin: '' })}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${form.type === 'product' ? 'surface text-default shadow-sm' : 'text-soft hover:text-default'}`}
                  >
                    Producto
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'service', unit: form.unit === 'u' ? 'servicio' : form.unit })}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${form.type === 'service' ? 'surface text-default shadow-sm' : 'text-soft hover:text-default'}`}
                  >
                    Servicio
                  </button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-default mb-1">Nombre del {form.type === 'service' ? 'servicio' : 'producto'} *</label>
                <input
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={form.type === 'service' ? 'Ej: Consultoría mensual, Corte de cabello...' : 'Ej: Camiseta talla M, Botella de agua...'}
                  required
                  className="w-full surface border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-default mb-1">Precio de venta *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-soft text-sm">$</span>
                  <input
                    type="number" min="0" step="any"
                    value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0"
                    required
                    className="w-full surface border rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-default mb-1">Costo (opcional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-soft text-sm">$</span>
                  <input
                    type="number" min="0" step="any"
                    value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })}
                    placeholder="0"
                    className="w-full surface border rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-default mb-1">SKU / Código</label>
                <input
                  value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="PROD-001"
                  className="w-full surface border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-default mb-1">Categoría</label>
                <input
                  value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Servicios, Ropa, Alimentos..."
                  className="w-full surface border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-default mb-1">Unidad</label>
                {form.type === 'service' ? (
                  <select
                    value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full surface border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand"
                  >
                    <option value="servicio">servicio</option>
                    <option value="hora">hora</option>
                    <option value="sesión">sesión</option>
                  </select>
                ) : (
                  <input
                    value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="u"
                    className="w-full surface border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand"
                  />
                )}
              </div>
              {form.type === 'service' && (
                <div>
                  <label className="block text-xs font-medium text-default mb-1">Duración (min) <span className="text-soft font-normal">opcional</span></label>
                  <input
                    type="number" min="0" step="1"
                    value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
                    placeholder="Ej: 30, 60..."
                    className="w-full surface border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand"
                  />
                </div>
              )}
              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                  className="px-4 py-2 text-sm text-soft border border-default rounded-lg hover:bg-[var(--surface-2)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={saving}
                  className="px-5 py-2 bg-brand text-ink-900 rounded-lg text-sm font-semibold hover:bg-brand-300 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar producto'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        {products.length > 0 && (
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU o categoría..."
            className="w-full surface border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ring-brand mb-4"
          />
        )}

        {/* List */}
        {loadError ? (
          <LoadError onRetry={() => fetchProducts()} />
        ) : (
        <div className="surface rounded-xl border overflow-hidden">
          {loading ? (
            <div className="space-y-px">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 surface-2 animate-pulse border-b border-default" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="text-4xl mb-3 opacity-30">▤</div>
              <p className="text-default font-medium mb-1">
                {search ? 'No encontramos productos con ese criterio.' : 'Aún no tienes productos'}
              </p>
              <p className="text-sm text-soft mb-4">
                {!search && 'Agrega productos o servicios para incluirlos en tus facturas.'}
              </p>
              {!search && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-block bg-brand text-ink-900 px-5 py-2 rounded-xl text-sm font-semibold hover:bg-brand-300"
                >
                  Agregar primer producto →
                </button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="surface-2 border-b border-default">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-soft uppercase tracking-wide">Producto</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-soft uppercase tracking-wide hidden sm:table-cell">SKU</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-soft uppercase tracking-wide hidden md:table-cell">Categoría</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-soft uppercase tracking-wide">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((p) => (
                  <tr key={p.id} onClick={() => router.push(`/products/${p.id}`)}
                    className="hover:bg-[var(--surface-2)] transition-colors cursor-pointer">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-brand hover:underline">{p.name}</p>
                      {p.unit && <p className="text-xs text-soft">por {p.unit}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-soft font-mono hidden sm:table-cell">{p.sku}</td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      {p.category ? (
                        <span className="text-xs surface-2 text-soft px-2.5 py-1 rounded-full">{p.category}</span>
                      ) : (
                        <span className="text-xs text-soft">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-default text-right">
                      ${p.price.toLocaleString('es-CO')}
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
