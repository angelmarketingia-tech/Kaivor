'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';
import LoadError from '@/components/LoadError';
import { useToast } from '@/contexts/ToastContext';

const API = process.env.NEXT_PUBLIC_API_URL;

type TableStatus = 'free' | 'occupied' | 'bill_requested';

interface OrderItem {
  name: string;
  qty: number;
  unitPrice: number;
  notes?: string;
}

interface CurrentOrder {
  id: string;
  status: string;
  items: OrderItem[];
  subtotal: number;
  waiter?: string;
}

interface RestaurantTable {
  id: string;
  name: string;
  zone?: string;
  seats: number;
  status: TableStatus;
  posX?: number;
  posY?: number;
  currentOrder?: CurrentOrder | null;
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  price: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

const STATUS_META: Record<TableStatus, { label: string; ring: string; card: string; dot: string; chip: string }> = {
  free: {
    label: 'Libre',
    ring: 'border-emerald-200 hover:border-emerald-400',
    card: 'surface',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700',
  },
  occupied: {
    label: 'Ocupada',
    ring: 'border-amber-300 hover:border-amber-400',
    card: 'bg-amber-50/60',
    dot: 'bg-amber-500',
    chip: 'bg-amber-100 text-amber-800',
  },
  bill_requested: {
    label: 'Pidió cuenta',
    ring: 'border-brand hover:border-brand-300',
    card: 'bg-brand-50/60',
    dot: 'bg-brand',
    chip: 'bg-brand-50 text-ink-900',
  },
};

const EMPTY_TABLE_FORM = { name: '', zone: '', seats: '4' };

export default function TablesPage() {
  const router = useRouter();
  const toast = useToast();

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // create-table modal
  const [showCreate, setShowCreate] = useState(false);
  const [tableForm, setTableForm] = useState(EMPTY_TABLE_FORM);
  const [creating, setCreating] = useState(false);

  // order side panel
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<OrderItem[]>([]);
  const [savingItems, setSavingItems] = useState(false);
  const [acting, setActing] = useState<string | null>(null); // tracks which action button is busy

  // add-item controls
  const [productPick, setProductPick] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    fetchAll(token);
    pollRef.current = setInterval(() => fetchTables(), 20000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [router]);

  const authHeaders = () => {
    const t = localStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : undefined;
  };

  const fetchAll = async (token?: string) => {
    const t = token ?? localStorage.getItem('token');
    if (!t) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [tRes, pRes] = await Promise.allSettled([
        axios.get(`${API}/tables`, { headers: { Authorization: `Bearer ${t}` } }),
        axios.get(`${API}/products`, { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (tRes.status === 'fulfilled') {
        setTables(tRes.value.data.tables ?? []);
      } else {
        setLoadError(true);
      }
      if (pRes.status === 'fulfilled') {
        const list = Array.isArray(pRes.value.data) ? pRes.value.data : (pRes.value.data.products ?? []);
        setProducts(list);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  // lightweight refresh used by polling — never toggles the full-page spinner
  const fetchTables = async () => {
    const headers = authHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(`${API}/tables`, { headers });
      const next: RestaurantTable[] = res.data.tables ?? [];
      setTables(next);
      // keep the open panel in sync if its order changed elsewhere — but don't clobber unsaved drafts
      setActiveId((cur) => {
        if (cur && !next.some((t) => t.id === cur)) return null;
        return cur;
      });
    } catch {
      // silent: polling shouldn't surface transient errors
    }
  };

  const activeTable = tables.find((t) => t.id === activeId) ?? null;

  const openTable = async (table: RestaurantTable) => {
    setActiveId(table.id);
    const headers = authHeaders();
    if (!headers) return;
    setActing('open');
    try {
      // POST opens or returns the existing open order, and marks the table occupied
      const res = await axios.post(`${API}/tables/${table.id}/order`, {}, { headers });
      const order: CurrentOrder = res.data;
      setDraftItems((order.items ?? []).map((i) => ({ ...i })));
      // reflect occupied status locally without waiting for poll
      setTables((prev) => prev.map((t) =>
        t.id === table.id
          ? { ...t, status: t.status === 'free' ? 'occupied' : t.status, currentOrder: order }
          : t,
      ));
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos abrir la mesa.');
      setActiveId(null);
    } finally {
      setActing(null);
    }
  };

  const closePanel = () => {
    setActiveId(null);
    setDraftItems([]);
    setProductPick('');
    setCustomName('');
    setCustomPrice('');
    setCustomQty('1');
  };

  const draftSubtotal = draftItems.reduce((s, i) => s + i.unitPrice * i.qty, 0);

  const addProduct = () => {
    if (!productPick) return;
    const p = products.find((x) => x.id === productPick);
    if (!p) return;
    setDraftItems((prev) => {
      const idx = prev.findIndex((i) => i.name === p.name && i.unitPrice === p.price && !i.notes);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { name: p.name, qty: 1, unitPrice: p.price }];
    });
    setProductPick('');
  };

  const addCustom = () => {
    const name = customName.trim();
    const price = parseFloat(customPrice);
    const qty = Math.max(1, parseInt(customQty || '1', 10));
    if (!name) { toast.error('Escribe el nombre del producto.'); return; }
    if (isNaN(price) || price < 0) { toast.error('Ingresa un precio válido.'); return; }
    setDraftItems((prev) => [...prev, { name, qty, unitPrice: price }]);
    setCustomName('');
    setCustomPrice('');
    setCustomQty('1');
  };

  const changeQty = (idx: number, delta: number) => {
    setDraftItems((prev) => {
      const copy = [...prev];
      const next = copy[idx].qty + delta;
      if (next <= 0) { copy.splice(idx, 1); return copy; }
      copy[idx] = { ...copy[idx], qty: next };
      return copy;
    });
  };

  const removeItem = (idx: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // persist current draft items to the open order (recomputes subtotal server-side)
  const saveItems = async (opts?: { status?: string; silent?: boolean }): Promise<boolean> => {
    if (!activeTable) return false;
    const headers = authHeaders();
    if (!headers) return false;
    setSavingItems(true);
    try {
      const body: any = { items: draftItems };
      if (opts?.status) body.status = opts.status;
      const res = await axios.patch(`${API}/tables/${activeTable.id}/order`, body, { headers });
      const order: CurrentOrder = res.data;
      setTables((prev) => prev.map((t) =>
        t.id === activeTable.id ? { ...t, currentOrder: order } : t,
      ));
      if (Array.isArray(order.items)) setDraftItems(order.items.map((i) => ({ ...i })));
      if (!opts?.silent) toast.success('Pedido actualizado.');
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos guardar el pedido.');
      return false;
    } finally {
      setSavingItems(false);
    }
  };

  const sendToKitchen = async () => {
    setActing('kitchen');
    const ok = await saveItems({ status: 'sent_to_kitchen', silent: true });
    if (ok) toast.success('Pedido enviado a cocina.');
    setActing(null);
  };

  const requestBill = async () => {
    if (!activeTable) return;
    const headers = authHeaders();
    if (!headers) return;
    setActing('bill');
    try {
      await axios.patch(`${API}/tables/${activeTable.id}/order`, { status: 'bill_requested' }, { headers });
      setTables((prev) => prev.map((t) =>
        t.id === activeTable.id ? { ...t, status: 'bill_requested' } : t,
      ));
      toast.success('Cuenta solicitada.');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos pedir la cuenta.');
    } finally {
      setActing(null);
    }
  };

  const chargeAndClose = async () => {
    if (!activeTable) return;
    const headers = authHeaders();
    if (!headers) return;
    if (draftItems.length === 0) { toast.error('Agrega al menos un producto antes de cobrar.'); return; }
    setActing('close');
    try {
      // make sure the latest items are saved before billing
      await axios.patch(`${API}/tables/${activeTable.id}/order`, { items: draftItems }, { headers });

      // best-effort: create the invoice from the order
      try {
        await axios.post(
          `${API}/invoices`,
          {
            tableNumber: activeTable.name,
            items: draftItems.map((i) => ({
              name: i.name,
              quantity: i.qty,
              unitPrice: i.unitPrice,
              notes: i.notes,
            })),
          },
          { headers },
        );
      } catch {
        // if invoice creation isn't wired, still close the table below
      }

      await axios.post(`${API}/tables/${activeTable.id}/close`, {}, { headers });

      setTables((prev) => prev.map((t) =>
        t.id === activeTable.id ? { ...t, status: 'free', currentOrder: null } : t,
      ));
      toast.success(`Mesa ${activeTable.name} cobrada y liberada.`);
      closePanel();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos cerrar la mesa.');
    } finally {
      setActing(null);
    }
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = tableForm.name.trim();
    if (!name) { toast.error('El nombre de la mesa es requerido.'); return; }
    const headers = authHeaders();
    if (!headers) return;
    setCreating(true);
    try {
      await axios.post(
        `${API}/tables`,
        {
          name,
          zone: tableForm.zone.trim() || undefined,
          seats: tableForm.seats ? parseInt(tableForm.seats, 10) : undefined,
        },
        { headers },
      );
      toast.success('Mesa creada.');
      setTableForm(EMPTY_TABLE_FORM);
      setShowCreate(false);
      fetchTables();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos crear la mesa.');
    } finally {
      setCreating(false);
    }
  };

  const counts = {
    free: tables.filter((t) => t.status === 'free').length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    bill: tables.filter((t) => t.status === 'bill_requested').length,
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-default">Mesas</h1>
            <p className="text-sm text-soft mt-0.5">
              {tables.length === 0
                ? 'Gestiona el salón en tiempo real'
                : `${tables.length} mesa${tables.length !== 1 ? 's' : ''} · actualiza cada 20s`}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-brand text-ink-900 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-brand-300 transition-colors whitespace-nowrap"
          >
            + Mesa
          </button>
        </div>

        {/* Legend / quick stats */}
        {tables.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 mb-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> {counts.free} libres
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> {counts.occupied} ocupadas
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-ink-900 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-brand" /> {counts.bill} pidieron cuenta
            </span>
          </div>
        )}

        {/* Body */}
        {loadError ? (
          <LoadError onRetry={() => fetchAll()} />
        ) : loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-36 surface-2 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : tables.length === 0 ? (
          <div className="surface rounded-2xl border text-center py-20 px-6">
            <div className="text-5xl mb-4">🍽️</div>
            <p className="text-default font-semibold mb-1">Aún no tienes mesas</p>
            <p className="text-sm text-soft mb-5 max-w-sm mx-auto">
              Crea tu primera mesa para empezar a tomar pedidos y cobrar directamente desde el salón.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-block bg-brand text-ink-900 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-300"
            >
              Crear primera mesa →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {tables.map((t) => {
              const meta = STATUS_META[t.status];
              const total = t.currentOrder?.subtotal ?? 0;
              return (
                <button
                  key={t.id}
                  onClick={() => openTable(t)}
                  className={`text-left rounded-2xl border p-4 transition-all hover:shadow-md ${meta.ring} ${meta.card}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-base font-bold text-default truncate">{t.name}</span>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${meta.dot}`} />
                  </div>
                  <div className="flex items-center gap-2 mb-3 text-xs text-soft">
                    {t.zone && <span className="truncate">{t.zone}</span>}
                    {t.zone && <span className="text-soft">·</span>}
                    <span className="whitespace-nowrap">{t.seats} 🪑</span>
                  </div>
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium ${meta.chip}`}>
                    {meta.label}
                  </span>
                  {t.status !== 'free' && (
                    <p className="mt-2 text-sm font-semibold text-default">{money(total)}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Create-table modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/50 flex items-center justify-center p-4"
          onClick={() => !creating && setShowCreate(false)}
        >
          <div
            className="surface rounded-2xl border w-full max-w-md p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-default mb-4">Nueva mesa</h2>
            <form onSubmit={handleCreateTable} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-default mb-1">Nombre / número *</label>
                <input
                  value={tableForm.name}
                  onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })}
                  placeholder="Mesa 1"
                  autoFocus
                  className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-default mb-1">Zona</label>
                  <input
                    value={tableForm.zone}
                    onChange={(e) => setTableForm({ ...tableForm, zone: e.target.value })}
                    placeholder="Terraza"
                    className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-default mb-1">Sillas</label>
                  <input
                    type="number" min={1}
                    value={tableForm.seats}
                    onChange={(e) => setTableForm({ ...tableForm, seats: e.target.value })}
                    className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setTableForm(EMPTY_TABLE_FORM); }}
                  className="px-4 py-2 text-sm text-soft hover:text-default border border-default rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={creating}
                  className="px-5 py-2 bg-brand text-ink-900 rounded-lg text-sm font-semibold hover:bg-brand-300 disabled:opacity-50"
                >
                  {creating ? 'Creando...' : 'Crear mesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order side panel */}
      {activeTable && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-ink-900/50" onClick={closePanel} />
          <div className="relative app-bg w-full max-w-md h-full shadow-2xl flex flex-col">
            {/* Panel header */}
            <div className="surface border-b px-5 py-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-default">{activeTable.name}</h2>
                <p className="text-xs text-soft mt-0.5">
                  {activeTable.zone ? `${activeTable.zone} · ` : ''}{activeTable.seats} sillas
                  {activeTable.currentOrder?.waiter ? ` · ${activeTable.currentOrder.waiter}` : ''}
                </p>
              </div>
              <button onClick={closePanel} className="text-soft hover:text-default text-xl leading-none px-1">×</button>
            </div>

            {/* Add item controls */}
            <div className="surface border-b px-5 py-4 space-y-3">
              {products.length > 0 && (
                <div className="flex gap-2">
                  <select
                    value={productPick}
                    onChange={(e) => setProductPick(e.target.value)}
                    className="flex-1 surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                  >
                    <option value="">Elegir del catálogo…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {money(p.price)}</option>
                    ))}
                  </select>
                  <button
                    onClick={addProduct}
                    disabled={!productPick}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Añadir
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Producto libre"
                  className="flex-1 min-w-0 surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
                <input
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="Precio" inputMode="decimal"
                  className="w-20 surface border rounded-lg px-2 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
                <input
                  value={customQty}
                  onChange={(e) => setCustomQty(e.target.value)}
                  type="number" min={1}
                  className="w-14 surface border rounded-lg px-2 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
                <button
                  onClick={addCustom}
                  className="px-3 py-2 bg-ink-900 text-white rounded-lg text-sm font-medium hover:bg-ink-700"
                >
                  +
                </button>
              </div>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {acting === 'open' ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-12 surface rounded-lg animate-pulse" />)}
                </div>
              ) : draftItems.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-3xl mb-2 opacity-30">🧾</div>
                  <p className="text-sm text-soft">Sin productos aún.</p>
                  <p className="text-xs text-soft mt-0.5">Agrega ítems del catálogo o escríbelos arriba.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {draftItems.map((it, idx) => (
                    <li key={idx} className="surface rounded-xl border px-3 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-default truncate">{it.name}</p>
                        <p className="text-xs text-soft">{money(it.unitPrice)} c/u · {money(it.unitPrice * it.qty)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => changeQty(idx, -1)} className="w-7 h-7 rounded-lg border border-default text-soft hover:bg-surface-2 font-medium">−</button>
                        <span className="w-6 text-center text-sm font-semibold text-default">{it.qty}</span>
                        <button onClick={() => changeQty(idx, 1)} className="w-7 h-7 rounded-lg border border-default text-soft hover:bg-surface-2 font-medium">+</button>
                        <button onClick={() => removeItem(idx)} className="ml-1 text-soft hover:text-red-500 text-lg leading-none px-1">×</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer actions */}
            <div className="surface border-t px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-soft">Total</span>
                <span className="text-xl font-bold text-default">{money(draftSubtotal)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => saveItems()}
                  disabled={savingItems || !!acting}
                  className="px-3 py-2.5 rounded-xl border border-default text-default text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
                >
                  {savingItems ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  onClick={sendToKitchen}
                  disabled={savingItems || !!acting || draftItems.length === 0}
                  className="px-3 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                >
                  {acting === 'kitchen' ? 'Enviando…' : 'Enviar a cocina'}
                </button>
                <button
                  onClick={requestBill}
                  disabled={!!acting || draftItems.length === 0}
                  className="px-3 py-2.5 rounded-xl bg-brand-50 text-ink-900 text-sm font-medium hover:bg-brand-100 disabled:opacity-50"
                >
                  {acting === 'bill' ? 'Pidiendo…' : 'Pedir cuenta'}
                </button>
                <button
                  onClick={chargeAndClose}
                  disabled={!!acting || draftItems.length === 0}
                  className="px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {acting === 'close' ? 'Cobrando…' : 'Cobrar y cerrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
