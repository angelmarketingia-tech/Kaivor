'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtDate = (d: string) => new Date(d).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' } as any);

const MOVE_LABEL: Record<string, string> = { sale: 'Venta', purchase: 'Compra', adjustment: 'Ajuste', return: 'Devolución' };
const STATUS: Record<string, { label: string; cls: string }> = {
  in_stock: { label: 'En stock', cls: 'bg-emerald-100 text-emerald-700' },
  low: { label: 'Stock bajo', cls: 'bg-amber-100 text-amber-700' },
  out: { label: 'Sin stock', cls: 'bg-red-100 text-red-700' },
};

export default function ProductDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ kind: 'notfound' | 'fail'; msg: string } | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [newQty, setNewQty] = useState('');
  const [newReorder, setNewReorder] = useState('');
  const [adjNotes, setAdjNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  // Editar / eliminar producto
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<any>({});
  const [deleting, setDeleting] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!token) { router.push('/auth/login'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API}/products/${id}`, { headers });
      setData(res.data);
      setNewQty(String(res.data.stats.totalStock));
      setNewReorder(String(res.data.stats.reorderPoint));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) { router.push('/auth/login'); return; }
      if (status === 404) setError({ kind: 'notfound', msg: 'Este producto no existe o fue eliminado.' });
      else setError({ kind: 'fail', msg: 'No pudimos cargar el producto. Revisa tu conexión e intenta de nuevo.' });
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const saveAdjust = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/products/${id}/adjust-stock`, {
        newQuantity: Number(newQty), reorderPoint: Number(newReorder), notes: adjNotes,
      }, { headers });
      showToast('Stock actualizado correctamente.', 'ok');
      setAdjusting(false); setAdjNotes('');
      await load();
    } catch { showToast('No pudimos ajustar el stock.', 'err'); }
    finally { setSaving(false); }
  };

  const openEdit = () => {
    const p = data.product;
    setEdit({
      name: p.name ?? '', sku: p.sku ?? '', category: p.category ?? '',
      price: String(p.price ?? ''), cost: p.cost != null ? String(p.cost) : '',
      barcode: p.barcode ?? '', unit: p.unit ?? 'u', isActive: p.isActive !== false,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!edit.name?.trim()) { showToast('El nombre es obligatorio.', 'err'); return; }
    if (edit.price === '' || isNaN(Number(edit.price)) || Number(edit.price) < 0) { showToast('Precio inválido.', 'err'); return; }
    setSaving(true);
    try {
      await axios.patch(`${API}/products/${id}`, {
        name: edit.name, sku: edit.sku, category: edit.category || null,
        price: edit.price, cost: edit.cost, barcode: edit.barcode || null,
        unit: edit.unit, isActive: edit.isActive,
      }, { headers });
      showToast('Producto actualizado.', 'ok');
      setEditing(false);
      await load();
    } catch (e: any) { showToast(e.response?.data?.message || 'No pudimos guardar los cambios.', 'err'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = await axios.delete(`${API}/products/${id}`, { headers });
      if (res.data?.softDeleted) {
        showToast('El producto tiene ventas; se desactivó para conservar el histórico.', 'ok');
        setDeleting(false);
        await load();
      } else {
        showToast('Producto eliminado.', 'ok');
        setTimeout(() => router.push('/products'), 600);
      }
    } catch (e: any) { showToast(e.response?.data?.message || 'No pudimos eliminar el producto.', 'err'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    </AppLayout>
  );
  if (error) return (
    <AppLayout>
      <div className="p-6 max-w-md mx-auto mt-16 text-center">
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <div className="text-4xl mb-3">{error.kind === 'notfound' ? '🔍' : '⚠️'}</div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            {error.kind === 'notfound' ? 'Producto no encontrado' : 'No pudimos cargar el producto'}
          </h2>
          <p className="text-sm text-slate-500 mb-5">{error.msg}</p>
          <div className="flex gap-2 justify-center">
            {error.kind === 'fail' && (
              <button onClick={load} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700">
                Reintentar
              </button>
            )}
            <Link href="/products" className="border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
              Volver a productos
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
  if (!data) return null;

  const { product, stats, inventory } = data;
  const st = STATUS[stats.stockStatus] ?? STATUS.in_stock;
  const allMovements = inventory.flatMap((inv: any) => inv.movements).sort((a: any, b: any) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.msg}
          </div>
        )}

        <div className="flex items-center gap-2 mb-4 text-sm">
          <Link href="/products" className="text-slate-500 hover:text-slate-900">Productos</Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-medium">{product.name}</span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
                {product.isActive === false && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Inactivo</span>}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">SKU: {product.sku}</p>
              {product.category && <p className="text-sm text-slate-500">Categoría: {product.category}</p>}
              {product.barcode && <p className="text-sm text-slate-500">Código de barras: {product.barcode}</p>}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">{fmt(product.price)}</p>
              {product.cost != null && <p className="text-sm text-slate-500">Costo: {fmt(product.cost)}</p>}
            </div>
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
            <button onClick={openEdit}
              className="text-xs font-medium bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700">
              Editar producto
            </button>
            <button onClick={() => setDeleting(true)}
              className="text-xs font-medium border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50">
              Eliminar
            </button>
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Inventario</h2>
            <button onClick={() => setAdjusting(true)}
              className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700">
              Ajustar stock
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500">Stock actual</p>
              <p className="text-xl font-bold text-slate-900">{stats.totalStock}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500">Punto de reorden</p>
              <p className="text-xl font-bold text-slate-900">{stats.reorderPoint}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center flex flex-col items-center justify-center">
              <p className="text-xs text-slate-500 mb-1">Estado</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
            </div>
          </div>
          {inventory.length === 0 && (
            <p className="text-xs text-slate-400 mt-3">Este producto aún no tiene inventario configurado. Usa "Ajustar stock" para iniciar el seguimiento.</p>
          )}
        </div>

        {/* Sales stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase">Unidades vendidas</p>
            <p className="text-lg font-bold text-slate-900">{stats.totalSold}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase">Ingresos generados</p>
            <p className="text-lg font-bold text-slate-900">{fmt(stats.totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase">Veces facturado</p>
            <p className="text-lg font-bold text-slate-900">{stats.timesInvoiced}</p>
          </div>
        </div>

        {/* Movements */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Movimientos de inventario</h2>
          </div>
          {allMovements.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Sin movimientos registrados.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {allMovements.map((m: any) => (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{MOVE_LABEL[m.type] ?? m.type}</p>
                    {m.notes && <p className="text-xs text-slate-500">{m.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${m.quantity >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.quantity >= 0 ? '+' : ''}{m.quantity}
                    </p>
                    <p className="text-xs text-slate-400">{fmtDate(m.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Adjust modal */}
        {adjusting && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAdjusting(false)}>
            <div className="bg-white rounded-xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Ajustar stock</h3>
              <label className="text-xs text-slate-500 block mb-1">Cantidad actual</label>
              <input type="number" min={0} value={newQty} onChange={e => setNewQty(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3" />
              <label className="text-xs text-slate-500 block mb-1">Punto de reorden</label>
              <input type="number" min={0} value={newReorder} onChange={e => setNewReorder(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3" />
              <label className="text-xs text-slate-500 block mb-1">Notas (opcional)</label>
              <input type="text" value={adjNotes} onChange={e => setAdjNotes(e.target.value)}
                placeholder="Ej: conteo físico, compra a proveedor…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4" />
              <div className="flex gap-2">
                <button onClick={saveAdjust} disabled={saving}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button onClick={() => setAdjusting(false)}
                  className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editing && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !saving && setEditing(false)}>
            <div className="bg-white rounded-xl p-5 max-w-md w-full max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-slate-900 mb-4">Editar producto</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Nombre *</label>
                  <input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">SKU</label>
                    <input value={edit.sku} onChange={e => setEdit({ ...edit, sku: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Categoría</label>
                    <input value={edit.category} onChange={e => setEdit({ ...edit, category: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Precio de venta *</label>
                    <input type="number" min={0} value={edit.price} onChange={e => setEdit({ ...edit, price: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Costo</label>
                    <input type="number" min={0} value={edit.cost} onChange={e => setEdit({ ...edit, cost: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Código de barras</label>
                    <input value={edit.barcode} onChange={e => setEdit({ ...edit, barcode: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Unidad</label>
                    <input value={edit.unit} onChange={e => setEdit({ ...edit, unit: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!edit.isActive} onChange={e => setEdit({ ...edit, isActive: e.target.checked })} />
                  <span className="text-sm text-slate-700">Producto activo (visible en el POS)</span>
                </label>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={saveEdit} disabled={saving}
                  className="flex-1 bg-brand text-ink-900 py-2 rounded-lg text-sm font-semibold hover:bg-brand-300 disabled:opacity-50">
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirm */}
        {deleting && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !saving && setDeleting(false)}>
            <div className="bg-white rounded-xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-slate-900 mb-1">¿Eliminar "{product.name}"?</h3>
              <p className="text-sm text-slate-500 mb-4">
                Si el producto ya tiene ventas registradas, se desactivará para conservar el histórico de facturas. Si no, se eliminará por completo.
              </p>
              <div className="flex gap-2">
                <button onClick={handleDelete} disabled={saving}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  {saving ? 'Procesando…' : 'Sí, eliminar'}
                </button>
                <button onClick={() => setDeleting(false)}
                  className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
