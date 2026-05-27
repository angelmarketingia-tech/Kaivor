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

const EMPTY_FORM = { name: '', sku: '', price: '', category: '', unit: 'u', cost: '' };

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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    fetchProducts(token);
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
            <h1 className="text-2xl font-bold text-slate-900">Productos y servicios</h1>
            <p className="text-sm text-slate-500 mt-0.5">{products.length} producto{products.length !== 1 ? 's' : ''} en catálogo</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            + Nuevo producto
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-violet-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Nuevo producto o servicio</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Nombre del producto *</label>
                <input
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Consultoría mensual, Camiseta talla M..."
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Precio de venta *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number" min="0" step="any"
                    value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0"
                    required
                    className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Costo (opcional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number" min="0" step="any"
                    value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })}
                    placeholder="0"
                    className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">SKU / Código</label>
                <input
                  value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="PROD-001"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Categoría</label>
                <input
                  value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Servicios, Ropa, Alimentos..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={saving}
                  className="px-5 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
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
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4 bg-white"
          />
        )}

        {/* List */}
        {loadError ? (
          <LoadError onRetry={() => fetchProducts()} />
        ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="space-y-px">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-50 animate-pulse border-b border-slate-100" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="text-4xl mb-3 opacity-30">▤</div>
              <p className="text-slate-600 font-medium mb-1">
                {search ? 'No encontramos productos con ese criterio.' : 'Aún no tienes productos'}
              </p>
              <p className="text-sm text-slate-400 mb-4">
                {!search && 'Agrega productos o servicios para incluirlos en tus facturas.'}
              </p>
              {!search && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-block bg-slate-900 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-slate-700"
                >
                  Agregar primer producto →
                </button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Producto</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">SKU</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Categoría</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} onClick={() => router.push(`/products/${p.id}`)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-violet-700 hover:underline">{p.name}</p>
                      {p.unit && <p className="text-xs text-slate-400">por {p.unit}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 font-mono hidden sm:table-cell">{p.sku}</td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      {p.category ? (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{p.category}</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-900 text-right">
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
