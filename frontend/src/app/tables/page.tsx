'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';
import LoadError from '@/components/LoadError';
import { useToast } from '@/contexts/ToastContext';
import TableCanvas from '@/components/tables/TableCanvas';
import TableDrawer from '@/components/tables/TableDrawer';
import SummaryHud from '@/components/tables/SummaryHud';
import AreaTabs from '@/components/tables/AreaTabs';
import CreateTableModal, { type NewTablePayload } from '@/components/tables/CreateTableModal';
import CreateZoneModal from '@/components/tables/CreateZoneModal';
import {
  type RestaurantTable,
  type Product,
  type OrderItem,
  type CurrentOrder,
  type TableArea,
  type TablesSummary,
  type TableStatus,
  STATUS_LABEL,
  money,
} from '@/components/tables/types';

const API = process.env.NEXT_PUBLIC_API_URL;

type ViewMode = 'map' | 'list';
type MapTheme = 'light' | 'arcade';
type EditMode = 'op' | 'edit';

const LS = {
  view: 'tables:view',
  theme: 'tables:mapTheme',
  mode: 'tables:mode',
  grid: 'tables:grid',
};

// privileged roles can edit + delete the layout
function canEditLayout(u: any): boolean {
  const r = u?.role;
  return r === 'admin' || r === 'manager' || r === 'platform_superadmin' || r === 'superadmin' || !!u?.platformRole;
}

// list-view status meta (kept from original page, extended for new states)
const LIST_META: Record<TableStatus, { ring: string; card: string; dot: string; chip: string }> = {
  free: { ring: 'border-emerald-200 hover:border-emerald-400', card: 'surface', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
  occupied: { ring: 'border-amber-300 hover:border-amber-400', card: 'bg-amber-50/60', dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-800' },
  bill_requested: { ring: 'border-brand hover:border-brand-300', card: 'bg-brand-50/60', dot: 'bg-brand', chip: 'bg-brand-50 text-ink-900' },
  reserved: { ring: 'border-teal-300 hover:border-teal-400', card: 'bg-teal-50/50', dot: 'bg-teal-500', chip: 'bg-teal-100 text-teal-800' },
  cleaning: { ring: 'border-slate-300 hover:border-slate-400', card: 'surface', dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600' },
  blocked: { ring: 'border-red-300 hover:border-red-400', card: 'bg-red-50/50 opacity-80', dot: 'bg-red-500', chip: 'bg-red-100 text-red-700' },
};

export default function TablesPage() {
  const router = useRouter();
  const toast = useToast();

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [areas, setAreas] = useState<TableArea[]>([]);
  const [summary, setSummary] = useState<TablesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [user, setUser] = useState<any>(null);
  // Alertas del comensal (QR) + QR de mesa
  const [calls, setCalls] = useState<{ id: string; tableName?: string; type: string; note?: string | null; createdAt: string }[]>([]);
  const [qrModal, setQrModal] = useState<{ name: string; url: string; dataUrl: string } | null>(null);

  // UI preferences (persisted in localStorage — never the layout itself)
  const [view, setView] = useState<ViewMode>('map');
  const [mapTheme, setMapTheme] = useState<MapTheme>('light');
  const [mode, setMode] = useState<EditMode>('op');
  const [showGrid, setShowGrid] = useState(true);
  const [activeArea, setActiveArea] = useState('all');

  // modals
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showZone, setShowZone] = useState(false);
  const [creatingZone, setCreatingZone] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);

  // order side panel (logic preserved from original)
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<OrderItem[]>([]);
  const [savingItems, setSavingItems] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  // add-item controls
  const [productPick, setProductPick] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Protección del arrastre frente al polling: mientras se arrastra o justo tras mover,
  // el poll NO debe pisar la posición local.
  const draggingRef = useRef(false);
  const recentlyMovedRef = useRef<Map<string, number>>(new Map());
  // Reloj que avanza cada minuto para que el cronómetro de ocupación se vea "vivo".
  const [, setClockTick] = useState(0);

  // ── preferences bootstrap ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS.view) as ViewMode | null;
      const t = localStorage.getItem(LS.theme) as MapTheme | null;
      const m = localStorage.getItem(LS.mode) as EditMode | null;
      const g = localStorage.getItem(LS.grid);
      if (v === 'map' || v === 'list') setView(v);
      if (t === 'light' || t === 'arcade') setMapTheme(t);
      if (m === 'op' || m === 'edit') setMode(m);
      if (g != null) setShowGrid(g === '1');
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = (key: string, val: string) => {
    try { localStorage.setItem(key, val); } catch {}
  };

  // ── data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    fetchAll(token);
    fetchCalls();
    // Las alertas del comensal se refrescan más seguido (cada 8s) para que el mesero reaccione rápido.
    const callsId = setInterval(() => fetchCalls(), 8000);
    pollRef.current = setInterval(() => { fetchTables(); fetchSummary(); }, 20000);
    // Tick de reloj cada 60s para refrescar el cronómetro de ocupación sin pegarle a la API.
    const clockId = setInterval(() => setClockTick((n) => n + 1), 60000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearInterval(clockId);
      clearInterval(callsId);
    };
  }, [router]);

  const authHeaders = () => {
    const t = localStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : undefined;
  };

  const fetchAll = async (token?: string) => {
    const t = token ?? localStorage.getItem('token');
    if (!t) return;
    const headers = { Authorization: `Bearer ${t}` };
    setLoading(true);
    setLoadError(false);
    try {
      const [tRes, pRes, aRes, sRes] = await Promise.allSettled([
        axios.get(`${API}/tables`, { headers }),
        axios.get(`${API}/products`, { headers }),
        axios.get(`${API}/tables/areas`, { headers }),
        axios.get(`${API}/tables/summary`, { headers }),
      ]);
      if (tRes.status === 'fulfilled') setTables(tRes.value.data.tables ?? tRes.value.data ?? []);
      else setLoadError(true);
      if (pRes.status === 'fulfilled') {
        const list = Array.isArray(pRes.value.data) ? pRes.value.data : (pRes.value.data.products ?? []);
        setProducts(list);
      }
      if (aRes.status === 'fulfilled') {
        const list = Array.isArray(aRes.value.data) ? aRes.value.data : (aRes.value.data.areas ?? []);
        setAreas(list);
      }
      if (sRes.status === 'fulfilled') setSummary(sRes.value.data ?? null);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  // polling refresh — never toggles the spinner, never clobbers unsaved drafts,
  // y NUNCA pisa una mesa que se está arrastrando o se acaba de mover.
  const fetchTables = async () => {
    const headers = authHeaders();
    if (!headers) return;
    // Si el usuario está arrastrando ahora mismo, no refrescamos (evita el salto del nodo).
    if (draggingRef.current) return;
    try {
      const res = await axios.get(`${API}/tables`, { headers });
      const next: RestaurantTable[] = res.data.tables ?? res.data ?? [];
      const moved = recentlyMovedRef.current;
      // Conserva la posición local de mesas movidas hace <8s (el PATCH puede no haberse reflejado).
      const merged = next.map((srv) => {
        const ts = moved.get(srv.id);
        if (ts && Date.now() - ts < 8000) {
          const local = tables.find((t) => t.id === srv.id);
          if (local) return { ...srv, posX: local.posX, posY: local.posY };
        }
        return srv;
      });
      setTables(merged);
      setActiveId((cur) => (cur && !merged.some((t) => t.id === cur) ? null : cur));
    } catch {}
  };

  const fetchSummary = async () => {
    const headers = authHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(`${API}/tables/summary`, { headers });
      setSummary(res.data ?? null);
    } catch {}
  };

  const fetchCalls = async () => {
    const headers = authHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(`${API}/tables/calls`, { headers });
      setCalls(res.data?.calls ?? []);
    } catch {}
  };

  const attendCall = async (id: string) => {
    const headers = authHeaders();
    if (!headers) return;
    setCalls((prev) => prev.filter((c) => c.id !== id)); // optimista
    try { await axios.post(`${API}/tables/calls/${id}/attend`, {}, { headers }); }
    catch { fetchCalls(); }
  };

  // Abre el QR de una mesa (lo genera como imagen para imprimir/compartir).
  const openQr = async (tableId: string, tableName: string) => {
    const headers = authHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(`${API}/tables/${tableId}/qr`, { headers });
      const url = `${window.location.origin}${res.data.path}`;
      const QR = (await import('qrcode')).default;
      const dataUrl = await QR.toDataURL(url, { width: 320, margin: 2, color: { dark: '#0B1220', light: '#FFFFFF' } });
      setQrModal({ name: tableName, url, dataUrl });
    } catch { toast.error('No pudimos generar el QR.'); }
  };

  // ── derived ───────────────────────────────────────────────────────────
  const activeTable = tables.find((t) => t.id === activeId) ?? null;
  const visibleTables = activeArea === 'all' ? tables : tables.filter((t) => (t.areaId ?? '') === activeArea);
  const editable = canEditLayout(user);
  const editing = mode === 'edit' && editable;

  const areaCounts: Record<string, number> = { all: tables.length };
  for (const a of areas) areaCounts[a.id] = tables.filter((t) => (t.areaId ?? '') === a.id).length;

  const draftSubtotal = draftItems.reduce((s, i) => s + i.unitPrice * i.qty, 0);

  // ── order flow (unchanged from original) ────────────────────────────────
  const openTable = async (table: RestaurantTable) => {
    if (acting) return; // evita doble-submit si una acción está en curso
    setActiveId(table.id);
    // non-order states open the drawer directly (no order POST)
    if (table.status === 'reserved' || table.status === 'cleaning' || table.status === 'blocked') {
      setDraftItems([]);
      return;
    }
    const headers = authHeaders();
    if (!headers) return;
    setActing('open');
    try {
      const res = await axios.post(`${API}/tables/${table.id}/order`, {}, { headers });
      const order: CurrentOrder = res.data;
      setDraftItems((order.items ?? []).map((i) => ({ ...i })));
      setTables((prev) => prev.map((t) =>
        t.id === table.id
          ? { ...t, status: t.status === 'free' ? 'occupied' : t.status, currentOrder: order, occupiedSince: t.occupiedSince ?? new Date().toISOString() }
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

  const removeItem = (idx: number) => setDraftItems((prev) => prev.filter((_, i) => i !== idx));

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
      setTables((prev) => prev.map((t) => (t.id === activeTable.id ? { ...t, currentOrder: order } : t)));
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
    if (!activeTable || acting) return;
    const id = activeTable.id; // id estable (evita stale-target tras el await)
    const headers = authHeaders();
    if (!headers) return;
    setActing('bill');
    try {
      // Persistir los ítems del borrador JUNTO con el cambio de estado (no perder ediciones).
      await axios.patch(`${API}/tables/${id}/order`, { items: draftItems, status: 'bill_requested' }, { headers });
      setTables((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'bill_requested' } : t)));
      toast.success('Cuenta solicitada.');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos pedir la cuenta.');
    } finally {
      setActing(null);
    }
  };

  const chargeAndClose = async () => {
    if (!activeTable || acting) return;
    const id = activeTable.id;
    const name = activeTable.name;
    const headers = authHeaders();
    if (!headers) return;
    // El cobro se basa en la orden REAL del servidor (que ya tiene los ítems del mesero
    // y/o del cliente por QR), NO en el borrador local. Solo bloqueamos si de verdad no hay nada.
    const hasServerItems = (activeTable.currentOrder?.items?.length ?? 0) > 0;
    if (draftItems.length === 0 && !hasServerItems) {
      toast.error('La mesa no tiene productos para cobrar.');
      return;
    }
    setActing('close');
    try {
      // 1) Si el mesero editó el borrador, guárdalo (merge en backend protege ítems del cliente).
      //    Si el borrador está vacío pero el servidor tiene ítems, NO mandamos items (no los borramos).
      if (draftItems.length > 0) {
        await axios.patch(`${API}/tables/${id}/order`, { items: draftItems }, { headers });
      }
      // 2) Cerrar la mesa: ESTE endpoint genera la factura (sin cliente = Consumidor Final) + inventario.
      const res = await axios.post(`${API}/tables/${id}/close`, { paymentMethod: 'cash' }, { headers });
      setTables((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'free', currentOrder: null, occupiedSince: null } : t)));
      const inv = res.data?.invoiceNumber ? ` (${res.data.invoiceNumber})` : '';
      toast.success(`Mesa ${name} cobrada y liberada${inv}.`);
      fetchSummary();
      closePanel();
    } catch (err: any) {
      // Si falla la factura/cierre, NO liberamos la mesa: el usuario ve el error y reintenta.
      toast.error(err.response?.data?.message ?? 'No pudimos cobrar la mesa. La mesa sigue abierta.');
    } finally {
      setActing(null);
    }
  };

  // ── new: status change (PATCH /tables/:id/status) ──────────────────────
  const setTableStatus = async (status: TableStatus) => {
    if (!activeTable || acting) return;
    const id = activeTable.id;
    const headers = authHeaders();
    if (!headers) return;
    const prevStatus = activeTable.status;
    setActing('status');
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await axios.patch(`${API}/tables/${id}/status`, { status }, { headers });
      toast.success(`Mesa marcada: ${STATUS_LABEL[status]}.`);
      if (status === 'free' || status === 'cleaning') { fetchSummary(); closePanel(); }
    } catch (err: any) {
      setTables((prev) => prev.map((t) => (t.id === id ? { ...t, status: prevStatus } : t)));
      toast.error(err.response?.data?.message ?? 'No pudimos cambiar el estado.');
    } finally {
      setActing(null);
    }
  };

  // Señales de arrastre para que el polling no pise la posición.
  const onDragStart = () => { draggingRef.current = true; };
  const onDragEnd = () => { draggingRef.current = false; };

  // ── new: move a node (optimistic + rollback) ───────────────────────────
  const moveTable = async (id: string, posX: number, posY: number) => {
    draggingRef.current = false;
    recentlyMovedRef.current.set(id, Date.now()); // protege esta posición ~8s del poll
    const headers = authHeaders();
    if (!headers) return;
    const prev = tables.find((t) => t.id === id);
    const prevPos = prev ? { posX: prev.posX, posY: prev.posY } : null;
    setTables((cur) => cur.map((t) => (t.id === id ? { ...t, posX, posY } : t)));
    try {
      await axios.patch(`${API}/tables/${id}/position`, { posX, posY }, { headers });
      toast.success('Posición guardada.');
    } catch (err: any) {
      if (prevPos) setTables((cur) => cur.map((t) => (t.id === id ? { ...t, ...prevPos } : t)));
      recentlyMovedRef.current.delete(id);
      toast.error('No pudimos mover la mesa. Reintenta.');
    }
  };

  // ── new: resize / rotate a node (optimistic + rollback) ─────────────────
  // Reusa el patrón de moveTable: PATCH /tables/:id/position con width/height/rotation.
  const resizeTable = async (id: string, width: number, height: number) => {
    recentlyMovedRef.current.set(id, Date.now()); // protege del poll ~8s
    const headers = authHeaders();
    if (!headers) return;
    const prev = tables.find((t) => t.id === id);
    const prevGeo = prev ? { width: prev.width, height: prev.height } : null;
    setTables((cur) => cur.map((t) => (t.id === id ? { ...t, width, height } : t)));
    try {
      await axios.patch(`${API}/tables/${id}/position`, { width, height }, { headers });
    } catch {
      if (prevGeo) setTables((cur) => cur.map((t) => (t.id === id ? { ...t, ...prevGeo } : t)));
      recentlyMovedRef.current.delete(id);
      toast.error('No pudimos cambiar el tamaño. Reintenta.');
    }
  };

  const rotateTable = async (id: string, rotation: number) => {
    recentlyMovedRef.current.set(id, Date.now());
    const headers = authHeaders();
    if (!headers) return;
    const prev = tables.find((t) => t.id === id);
    const prevRot = prev ? prev.rotation ?? 0 : 0;
    setTables((cur) => cur.map((t) => (t.id === id ? { ...t, rotation } : t)));
    try {
      await axios.patch(`${API}/tables/${id}/position`, { rotation }, { headers });
    } catch {
      setTables((cur) => cur.map((t) => (t.id === id ? { ...t, rotation: prevRot } : t)));
      recentlyMovedRef.current.delete(id);
      toast.error('No pudimos girar la mesa. Reintenta.');
    }
  };

  // ── new: unir mesas (POST /tables/merge) ────────────────────────────────
  const mergeTables = async (targetId: string, sourceIds: string[]) => {
    if (!sourceIds.length || acting) return;
    const headers = authHeaders();
    if (!headers) return;
    setActing('merge');
    try {
      await axios.post(`${API}/tables/merge`, { targetId, sourceIds }, { headers });
      toast.success('Mesas unidas.');
      // Si la mesa activa quedó cerrada por la unión, refrescamos su orden.
      if (activeId === targetId) {
        try {
          const res = await axios.post(`${API}/tables/${targetId}/order`, {}, { headers });
          const order: CurrentOrder = res.data;
          setDraftItems((order.items ?? []).map((i) => ({ ...i })));
        } catch {}
      }
      fetchTables();
      fetchSummary();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos unir las mesas.');
    } finally {
      setActing(null);
    }
  };

  // ── new: dividir cuenta (POST /tables/:id/split) ────────────────────────
  const splitBill = async (itemIndexes: number[], paymentMethod: string) => {
    if (!activeTable || !itemIndexes.length || acting) return;
    const id = activeTable.id;
    const name = activeTable.name;
    const headers = authHeaders();
    if (!headers) return;
    setActing('split');
    try {
      // Persistir los ítems vigentes antes de dividir (no perder ediciones del borrador).
      await axios.patch(`${API}/tables/${id}/order`, { items: draftItems }, { headers });
      const res = await axios.post(`${API}/tables/${id}/split`, { itemIndexes, paymentMethod }, { headers });
      const inv = res.data?.invoiceNumber ? ` (${res.data.invoiceNumber})` : '';
      toast.success(`Cuenta dividida cobrada${inv}.`);
      // ¿Quedan ítems? El backend indica si la mesa sigue abierta o se liberó.
      const stillOpen = res.data?.tableStatus
        ? res.data.tableStatus !== 'free'
        : Array.isArray(res.data?.remainingItems) && res.data.remainingItems.length > 0;
      fetchSummary();
      if (stillOpen) {
        // Recargar el borrador con lo que quedó en la mesa.
        try {
          const ord = await axios.post(`${API}/tables/${id}/order`, {}, { headers });
          const order: CurrentOrder = ord.data;
          setDraftItems((order.items ?? []).map((i) => ({ ...i })));
          setTables((prev) => prev.map((t) => (t.id === id ? { ...t, currentOrder: order } : t)));
        } catch { fetchTables(); }
      } else {
        setTables((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'free', currentOrder: null, occupiedSince: null } : t)));
        toast.success(`Mesa ${name} liberada.`);
        closePanel();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos dividir la cuenta.');
    } finally {
      setActing(null);
    }
  };

  // ── new: create table with shape/seats/zone ─────────────────────────────
  const handleCreateTable = async (payload: NewTablePayload) => {
    if (!payload.name) { toast.error('El nombre de la mesa es requerido.'); return; }
    const headers = authHeaders();
    if (!headers) return;
    setCreating(true);
    try {
      // drop near top-left so it's visible; user drags it into place in edit mode
      const offset = (tables.length % 6) * 24;
      await axios.post(`${API}/tables`, {
        name: payload.name,
        zone: payload.zone,
        areaId: payload.areaId,
        shape: payload.shape,
        seats: payload.seats,
        width: payload.width,
        height: payload.height,
        posX: 24 + offset,
        posY: 24 + offset,
        rotation: 0,
      }, { headers });
      toast.success('Mesa creada.');
      setShowCreate(false);
      fetchTables();
      fetchSummary();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos crear la mesa.');
    } finally {
      setCreating(false);
    }
  };

  // ── new: delete table (admin/manager only) ──────────────────────────────
  const deleteTable = async () => {
    if (!activeTable || !editable) return;
    if (!window.confirm(`¿Eliminar la mesa "${activeTable.name}"? Esta acción no se puede deshacer.`)) return;
    const headers = authHeaders();
    if (!headers) return;
    setActing('delete');
    try {
      await axios.delete(`${API}/tables/${activeTable.id}`, { headers });
      setTables((prev) => prev.filter((t) => t.id !== activeTable.id));
      toast.success('Mesa eliminada.');
      closePanel();
      fetchSummary();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos eliminar la mesa.');
    } finally {
      setActing(null);
    }
  };

  // Duplicar mesa: crea una copia con los mismos atributos, desplazada para no encimarse.
  const duplicateTable = async () => {
    if (!activeTable || !editable || acting) return;
    const headers = authHeaders();
    if (!headers) return;
    setActing('duplicate');
    try {
      const base = activeTable;
      // nombre " (copia)" o incrementa un sufijo numérico si ya termina en número
      const copyName = /\d+$/.test(base.name)
        ? base.name.replace(/(\d+)$/, (m) => String(Number(m) + 1))
        : `${base.name} (copia)`;
      const res = await axios.post(`${API}/tables`, {
        name: copyName,
        areaId: base.areaId ?? undefined,
        shape: base.shape,
        seats: base.seats,
        width: base.width,
        height: base.height,
        rotation: base.rotation,
        posX: (base.posX ?? 0) + 32,
        posY: (base.posY ?? 0) + 32,
      }, { headers });
      if (res.data?.id) {
        setTables((prev) => [...prev, { ...res.data, currentOrder: null }]);
        toast.success(`Mesa duplicada: ${copyName}`);
        setActiveId(res.data.id); // selecciona la nueva copia
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos duplicar la mesa.');
    } finally {
      setActing(null);
    }
  };

  // ── new: create zone (POST /tables/areas) ───────────────────────────────
  const handleCreateZone = async (name: string, color: string) => {
    const headers = authHeaders();
    if (!headers) return;
    setCreatingZone(true);
    try {
      const res = await axios.post(`${API}/tables/areas`, { name, color }, { headers });
      if (res.data?.id) {
        setAreas((prev) => [...prev, res.data]);
      } else {
        // Si la respuesta no trae la zona, recargamos desde el servidor (sin ids inventados).
        const aRes = await axios.get(`${API}/tables/areas`, { headers });
        setAreas(Array.isArray(aRes.data) ? aRes.data : (aRes.data.areas ?? []));
      }
      toast.success('Zona creada.');
      setShowZone(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos crear la zona.');
    } finally {
      setCreatingZone(false);
    }
  };

  // ── new: save layout (POST /tables/layout/save) ─────────────────────────
  const saveLayout = async () => {
    const headers = authHeaders();
    if (!headers) return;
    setSavingLayout(true);
    try {
      await axios.post(`${API}/tables/layout/save`, {
        name: 'default',
        tables: tables.map((t) => ({
          id: t.id,
          posX: t.posX ?? 0,
          posY: t.posY ?? 0,
          width: t.width,
          height: t.height,
          rotation: t.rotation ?? 0,
          areaId: t.areaId,
        })),
      }, { headers });
      toast.success('Distribución guardada.');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos guardar la distribución.');
    } finally {
      setSavingLayout(false);
    }
  };

  // ── toggle helpers ──────────────────────────────────────────────────────
  const setViewMode = (v: ViewMode) => { setView(v); persist(LS.view, v); };
  const setTheme = (t: MapTheme) => { setMapTheme(t); persist(LS.theme, t); };
  const setEditMode = (m: EditMode) => { setMode(m); persist(LS.mode, m); };
  const toggleGrid = () => { setShowGrid((g) => { persist(LS.grid, g ? '0' : '1'); return !g; }); };

  // small segmented-control button
  const Seg = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-brand text-ink-900' : 'text-soft hover:text-default'
      }`}
      style={{ minHeight: 40 }}
    >
      {children}
    </button>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-default">Mesas</h1>
            <p className="text-sm text-soft mt-0.5">
              {tables.length === 0 ? 'Diseña y opera tu salón en tiempo real' : `${tables.length} mesa${tables.length !== 1 ? 's' : ''} · actualiza cada 20s`}
            </p>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 surface border rounded-xl p-0.5">
              <Seg active={view === 'map'} onClick={() => setViewMode('map')}>Mapa</Seg>
              <Seg active={view === 'list'} onClick={() => setViewMode('list')}>Lista</Seg>
            </div>
            {view === 'map' && (
              <div className="flex items-center gap-0.5 surface border rounded-xl p-0.5">
                <Seg active={mapTheme === 'light'} onClick={() => setTheme('light')}>Claro</Seg>
                <Seg active={mapTheme === 'arcade'} onClick={() => setTheme('arcade')}>Arcade</Seg>
              </div>
            )}
            {editable && view === 'map' && (
              <div className="flex items-center gap-0.5 surface border rounded-xl p-0.5">
                <Seg active={mode === 'op'} onClick={() => setEditMode('op')}>Operación</Seg>
                <Seg active={mode === 'edit'} onClick={() => setEditMode('edit')}>Edición</Seg>
              </div>
            )}
          </div>
        </div>

        {/* Alertas del comensal (QR): llamar mesero / pedir cuenta */}
        {calls.length > 0 && (
          <div className="mb-3 rounded-xl border p-3" style={{ background: 'rgba(163,204,57,0.10)', borderColor: 'rgba(163,204,57,0.35)' }}>
            <p className="text-xs font-semibold text-default mb-2">🔔 {calls.length} llamado{calls.length > 1 ? 's' : ''} de mesas</p>
            <div className="flex flex-wrap gap-2">
              {calls.map((c) => {
                // El detalle del pedido listo viene en note como "Pedido listo: 2× Pizza, 1× Coca (sin hielo)".
                const detail = (c.type === 'ready' || c.type === 'order') && c.note
                  ? c.note.replace(/^Pedido listo:\s*/i, '')
                  : null;
                const ready = c.type === 'ready';
                return (
                  <div
                    key={c.id}
                    className="flex items-start gap-2 surface border rounded-lg pl-3 pr-1 py-1.5"
                    style={ready ? { borderColor: 'rgba(163,204,57,0.6)', background: 'rgba(163,204,57,0.12)' } : { borderColor: 'var(--border)' }}
                  >
                    <span className="text-sm text-default max-w-[260px]">
                      <span className="block">
                        {c.type === 'bill' ? '🧾' : ready ? '🍳' : c.type === 'order' ? '🍽️' : '🙋'} <strong>{c.tableName || 'Mesa'}</strong>
                        <span className="text-soft"> · {c.type === 'bill' ? 'pide cuenta' : ready ? 'pedido listo' : c.type === 'order' ? 'pidió desde el QR' : 'llama mesero'}</span>
                      </span>
                      {detail && <span className="block text-xs text-soft mt-0.5 leading-snug">{detail}</span>}
                    </span>
                    <button onClick={() => attendCall(c.id)} className="text-xs font-semibold bg-brand text-ink-900 px-2.5 py-1.5 rounded-md hover:bg-brand-300 shrink-0" style={{ minHeight: 36 }}>
                      {ready ? 'Recogido' : 'Atender'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* HUD */}
        <SummaryHud summary={summary} loading={loading} />

        {/* Edit toolbar (map + edit mode) */}
        {view === 'map' && editing && (
          <div className="flex flex-wrap items-center gap-2 mb-3 p-2.5 rounded-xl border border-dashed surface-2" style={{ borderColor: 'rgba(163,204,57,0.4)' }}>
            <span className="text-xs font-semibold text-soft px-1">✏️ Edición:</span>
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-brand text-ink-900 rounded-lg text-sm font-semibold hover:bg-brand-300 shadow-sm transition-colors" style={{ minHeight: 44 }}>
              + Mesa
            </button>
            <button onClick={saveLayout} disabled={savingLayout} className="px-4 py-2 bg-ink-900 text-white rounded-lg text-sm font-medium hover:bg-ink-700 disabled:opacity-50 transition-colors" style={{ minHeight: 44 }}>
              {savingLayout ? 'Guardando…' : '💾 Guardar distribución'}
            </button>
            <button onClick={toggleGrid} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${showGrid ? 'border-brand text-ink-900 bg-brand-50' : 'border-default text-soft hover:text-default'}`} style={{ minHeight: 44 }}>
              Cuadrícula {showGrid ? 'on' : 'off'}
            </button>
            <span className="text-xs text-soft ml-auto px-1">Arrastra las mesas para acomodar tu local · snap 8px</span>
          </div>
        )}

        {/* Area tabs */}
        {(areas.length > 0 || editing) && view === 'map' && (
          <AreaTabs
            areas={areas}
            activeArea={activeArea}
            counts={areaCounts}
            editing={editing}
            onSelect={setActiveArea}
            onCreate={() => setShowZone(true)}
          />
        )}

        {/* Body */}
        {loadError ? (
          <LoadError onRetry={() => fetchAll()} />
        ) : loading ? (
          <div className="rounded-2xl surface-2 animate-pulse" style={{ height: '70vh' }} />
        ) : view === 'list' ? (
          // ── LIST (fallback, original card grid extended) ──
          tables.length === 0 ? (
            <div className="surface rounded-2xl border text-center py-20 px-6">
              <div className="text-5xl mb-4">🍽️</div>
              <p className="text-default font-semibold mb-1">Aún no tienes mesas</p>
              <p className="text-sm text-soft mb-5 max-w-sm mx-auto">Crea tu primera mesa para empezar a tomar pedidos y cobrar desde el salón.</p>
              <button onClick={() => setShowCreate(true)} className="inline-block bg-brand text-ink-900 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-300">
                Crear primera mesa →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {visibleTables.map((t) => {
                const meta = LIST_META[t.status];
                const total = t.currentOrder?.subtotal ?? 0;
                return (
                  <button key={t.id} onClick={() => openTable(t)} className={`text-left rounded-2xl border p-4 transition-all hover:shadow-md ${meta.ring} ${meta.card}`}>
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-base font-bold text-default truncate">{t.name}</span>
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${meta.dot}`} />
                    </div>
                    <div className="flex items-center gap-2 mb-3 text-xs text-soft">
                      {t.zone && <span className="truncate">{t.zone}</span>}
                      {t.zone && <span className="text-soft">·</span>}
                      <span className="whitespace-nowrap">{t.seats} 🪑</span>
                    </div>
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium ${meta.chip}`}>{STATUS_LABEL[t.status]}</span>
                    {(t.status === 'occupied' || t.status === 'bill_requested') && (
                      <p className="mt-2 text-sm font-semibold text-default">{money(total)}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )
        ) : (
          // ── MAP ──
          <TableCanvas
            tables={visibleTables}
            theme={mapTheme}
            editing={editing}
            showGrid={showGrid}
            onSelect={openTable}
            onMove={moveTable}
            onDragStartSignal={onDragStart}
            onDragEndSignal={onDragEnd}
            onAddFirst={editable ? () => { setEditMode('edit'); setShowCreate(true); } : undefined}
          />
        )}
      </div>

      {/* Create-table modal */}
      {showCreate && (
        <CreateTableModal
          areas={areas}
          defaultAreaId={activeArea}
          submitting={creating}
          onCancel={() => setShowCreate(false)}
          onSubmit={handleCreateTable}
        />
      )}

      {/* Create-zone modal */}
      {showZone && (
        <CreateZoneModal submitting={creatingZone} onCancel={() => setShowZone(false)} onSubmit={handleCreateZone} />
      )}

      {/* Contextual drawer / bottom sheet */}
      {activeTable && (
        <TableDrawer
          table={activeTable}
          products={products}
          draftItems={draftItems}
          draftSubtotal={draftSubtotal}
          opening={acting === 'open'}
          acting={acting}
          savingItems={savingItems}
          productPick={productPick}
          setProductPick={setProductPick}
          customName={customName}
          setCustomName={setCustomName}
          customPrice={customPrice}
          setCustomPrice={setCustomPrice}
          customQty={customQty}
          setCustomQty={setCustomQty}
          onAddProduct={addProduct}
          onAddCustom={addCustom}
          onChangeQty={changeQty}
          onRemoveItem={removeItem}
          onSaveItems={() => saveItems()}
          onSendToKitchen={sendToKitchen}
          onRequestBill={requestBill}
          onChargeAndClose={chargeAndClose}
          onSetStatus={setTableStatus}
          onDelete={editable ? deleteTable : undefined}
          onDuplicate={editable ? duplicateTable : undefined}
          onResize={editable ? resizeTable : undefined}
          onRotate={editable ? rotateTable : undefined}
          occupiedTables={tables.filter((t) => (t.status === 'occupied' || t.status === 'bill_requested') && t.id !== activeTable.id)}
          onMerge={mergeTables}
          onSplit={splitBill}
          onQr={() => openQr(activeTable.id, activeTable.name)}
          editing={editing}
          onClose={closePanel}
        />
      )}

      {/* QR de mesa */}
      {qrModal && (
        <div className="fixed inset-0 z-[70] bg-ink-900/60 flex items-center justify-center p-4" onClick={() => setQrModal(null)}>
          <div className="surface rounded-2xl border p-6 max-w-xs w-full text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-default mb-1">QR · {qrModal.name}</p>
            <p className="text-xs text-soft mb-4">El cliente lo escanea para ver su cuenta, pedir la cuenta y llamar al mesero.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrModal.dataUrl} alt={`QR ${qrModal.name}`} className="mx-auto rounded-xl border border-default" width={240} height={240} />
            <p className="text-[10px] text-soft mt-3 break-all">{qrModal.url}</p>
            <div className="flex gap-2 mt-4">
              <a href={qrModal.dataUrl} download={`QR-${qrModal.name}.png`}
                className="flex-1 bg-brand text-ink-900 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-300">
                Descargar
              </a>
              <button onClick={() => setQrModal(null)}
                className="px-4 py-2.5 rounded-lg text-sm border border-default text-default hover:bg-black/5 dark:hover:bg-white/5">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
