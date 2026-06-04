'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

interface Product { id: string; name: string; price: number; sku: string; category?: string; type?: string; unit?: string; imageUrl?: string; color?: string; isActive?: boolean }
interface CartLine { productId?: string; name: string; qty: number; unitPrice: number; taxRate: number }
interface Vertical {
  id: string; label: string; emoji: string;
  features: { inventory: boolean; itemType: string; tip: boolean; serviceCharge: boolean; table: boolean; professional: boolean; duration: boolean; barcode: boolean };
  defaults: { unit: string; tipPercent: number; serviceChargePercent: number; itemNoun: string; customerNoun: string };
}

// Paleta de colores para tiles sin imagen — derivada del nombre para consistencia visual.
const TILE_COLORS = ['#7c3aed', '#0891b2', '#db2777', '#ea580c', '#16a34a', '#2563eb', '#ca8a04', '#dc2626', '#0d9488', '#9333ea'];
function tileColor(p: Product) {
  if (p.color) return p.color;
  let h = 0;
  for (let i = 0; i < p.name.length; i++) h = (h * 31 + p.name.charCodeAt(i)) >>> 0;
  return TILE_COLORS[h % TILE_COLORS.length];
}

const PAYMENT_METHODS: [string, string, string][] = [
  ['cash', 'Efectivo', '💵'], ['nequi', 'Nequi', '📲'], ['daviplata', 'Daviplata', '📲'],
  ['debit_card', 'T. Débito', '💳'], ['credit_card', 'T. Crédito', '💳'], ['qr', 'QR', '⬛'],
  ['bank_transfer', 'Transfer.', '🏦'], ['addi', 'Addi', '🧾'], ['credit_validation', 'Crédito', '🧾'],
];

export default function PosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [vertical, setVertical] = useState<Vertical | null>(null);
  const [companyId, setCompanyId] = useState<string>('');
  const [live, setLive] = useState<{ revenue: number; invoices: number; avgTicket: number } | null>(null);

  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('Todos');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [globalTax, setGlobalTax] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);

  // Contexto vertical
  const [tableNumber, setTableNumber] = useState('');
  const [professional, setProfessional] = useState('');

  // Cobro
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [serviceCharge, setServiceCharge] = useState('');
  const [charging, setCharging] = useState(false);
  const [doneInfo, setDoneInfo] = useState<{ id: string; total: number; change: number } | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadLive = () => {
    axios.get(`${API}/pos/live-stats`, { headers }).then(r => setLive(r.data.today)).catch(() => {});
  };

  const loadData = () => {
    setLoading(true);
    setLoadError(false);
    Promise.allSettled([
      axios.get(`${API}/products`, { headers }),
      axios.get(`${API}/companies/my`, { headers }),
      axios.get(`${API}/pos/live-stats`, { headers }),
    ]).then(([prodRes, compRes, liveRes]) => {
      if (prodRes.status === 'fulfilled') setProducts((prodRes.value.data as Product[]).filter(p => p.isActive !== false));
      else setLoadError(true);
      if (compRes.status === 'fulfilled') { setVertical(compRes.value.data?.vertical || null); setCompanyId(compRes.value.data?.id || ''); }
      if (liveRes.status === 'fulfilled') setLive(liveRes.value.data.today);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    loadData();
  }, []);

  // refrescar ventas en vivo cada 30s
  useEffect(() => {
    const t = setInterval(loadLive, 30000);
    return () => clearInterval(t);
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => p.category && set.add(p.category));
    return ['Todos', ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (activeCat !== 'Todos' && p.category !== activeCat) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    });
  }, [products, search, activeCat]);

  const addToCart = (p: Product) => {
    setCart(prev => {
      const i = prev.findIndex(l => l.productId === p.id);
      if (i >= 0) { const c = [...prev]; c[i] = { ...c[i], qty: c[i].qty + 1 }; return c; }
      return [...prev, { productId: p.id, name: p.name, qty: 1, unitPrice: p.price, taxRate: globalTax }];
    });
  };
  // Enter en búsqueda: para escáneres USB. Si hay un único match (SKU exacto o un solo resultado), agrégalo y limpia.
  const onSearchEnter = () => {
    const q = search.trim().toLowerCase();
    if (!q) return;
    const exactSku = products.find(p => p.sku.toLowerCase() === q && p.isActive !== false);
    const match = exactSku || (filtered.length === 1 ? filtered[0] : null);
    if (match) {
      addToCart(match);
      setSearch('');
    }
  };

  const changeQty = (idx: number, delta: number) => {
    setCart(prev => prev.flatMap((l, i) => {
      if (i !== idx) return [l];
      const q = l.qty + delta;
      return q <= 0 ? [] : [{ ...l, qty: q }];
    }));
  };
  const setLinePrice = (idx: number, price: number) => setCart(prev => prev.map((l, i) => i === idx ? { ...l, unitPrice: price } : l));
  const removeLine = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));
  const clearCart = () => { setCart([]); setTableNumber(''); setProfessional(''); setTipAmount(''); setServiceCharge(''); };

  const sub = cart.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const tax = cart.reduce((s, l) => s + l.qty * l.unitPrice * (l.taxRate / 100), 0);
  const tipN = Math.max(0, parseFloat(tipAmount) || 0);
  const svcN = Math.max(0, parseFloat(serviceCharge) || 0);
  const total = sub + tax + tipN + svcN;
  const cashN = parseFloat(cashReceived) || 0;
  const change = payMethod === 'cash' && cashN >= total ? cashN - total : 0;
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  const applyGlobalTax = (rate: number) => { setGlobalTax(rate); setCart(prev => prev.map(l => ({ ...l, taxRate: rate }))); };

  const charge = async () => {
    if (cart.length === 0 || charging) return;
    if (payMethod === 'cash' && cashN < total) { alert(`Recibido ${fmt(cashN)} es menor al total ${fmt(total)}`); return; }
    setCharging(true);
    try {
      const res = await axios.post(`${API}/invoices`, {
        companyId: companyId || undefined,
        items: cart.map(l => ({ productId: l.productId, description: l.name, quantity: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate, discountType: 'percent', discountValue: 0 })),
        paymentMethod: payMethod,
        cashReceived: payMethod === 'cash' ? cashN : undefined,
        tipAmount: tipN || undefined,
        serviceCharge: svcN || undefined,
        tableNumber: tableNumber || undefined,
        professional: professional || undefined,
      }, { headers });
      setDoneInfo({ id: res.data.id, total, change });
      clearCart(); setCashReceived(''); setPayOpen(false); setTicketOpen(false); loadLive();
    } catch (e: any) {
      alert(e.response?.data?.message || 'No se pudo registrar la venta.');
    } finally { setCharging(false); }
  };

  // Contenido del ticket — compartido entre el panel lateral (lg+) y el overlay móvil.
  const ticketInner = (
    <>
      {/* contexto vertical */}
      {(vertical?.features.table || vertical?.features.professional) && (
        <div className="px-4 pt-3 flex gap-2">
          {vertical.features.table && (
            <input value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="Mesa"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ring-brand" />
          )}
          {vertical.features.professional && (
            <input value={professional} onChange={e => setProfessional(e.target.value)} placeholder="Quién atiende"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ring-brand" />
          )}
        </div>
      )}

      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Ticket {itemCount > 0 && <span className="text-slate-400 font-normal text-sm">· {itemCount} ítem{itemCount !== 1 ? 's' : ''}</span>}</h2>
        <div className="flex items-center gap-1.5">
          <button onClick={() => applyGlobalTax(0)} className={`px-2 py-0.5 text-xs rounded font-medium ${globalTax === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>0%</button>
          <button onClick={() => applyGlobalTax(19)} className={`px-2 py-0.5 text-xs rounded font-medium ${globalTax === 19 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>IVA</button>
          {cart.length > 0 && <button onClick={clearCart} className="ml-1 text-slate-400 hover:text-red-500 text-xs">Vaciar</button>}
        </div>
      </div>

      {/* líneas */}
      <div className="flex-1 overflow-y-auto px-2 min-h-0">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-300 px-6">
            <div className="text-4xl mb-2">🛒</div>
            <p className="text-sm text-slate-400">Toca productos para agregarlos al ticket.</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {cart.map((l, idx) => (
              <li key={idx} className="rounded-xl hover:bg-slate-50 px-2 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800 leading-tight flex-1">{l.name}</p>
                  <button onClick={() => removeLine(idx)} aria-label={`Quitar ${l.name}`} className="text-slate-300 hover:text-red-500 text-sm leading-none">✕</button>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => changeQty(idx, -1)} aria-label={`Disminuir cantidad de ${l.name}`} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold leading-none active:scale-90 transition-transform">−</button>
                    <span className="w-7 text-center text-sm font-semibold">{l.qty}</span>
                    <button onClick={() => changeQty(idx, 1)} aria-label={`Aumentar cantidad de ${l.name}`} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold leading-none active:scale-90 transition-transform">+</button>
                    <input type="number" value={l.unitPrice} onChange={e => setLinePrice(idx, parseFloat(e.target.value) || 0)}
                      className="w-20 ml-1 border border-slate-200 rounded px-1.5 py-0.5 text-xs text-right" />
                  </div>
                  <span className="text-sm font-bold text-slate-900">{fmt(l.qty * l.unitPrice)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* totales + cobrar */}
      <div className="border-t border-slate-100 p-4 space-y-3 shrink-0">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{fmt(sub)}</span></div>
          {tax > 0 && <div className="flex justify-between text-slate-500"><span>IVA</span><span>{fmt(tax)}</span></div>}
          {svcN > 0 && <div className="flex justify-between text-slate-500"><span>Servicio</span><span>{fmt(svcN)}</span></div>}
          {tipN > 0 && <div className="flex justify-between text-slate-500"><span>Propina</span><span>{fmt(tipN)}</span></div>}
          <div className="flex justify-between items-end pt-1">
            <span className="font-semibold text-slate-700">Total</span>
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{fmt(total)}</span>
          </div>
        </div>
        <button onClick={() => { setPayOpen(true); setPayMethod('cash'); }} disabled={cart.length === 0}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white py-3.5 rounded-2xl font-bold text-lg transition-colors active:scale-[0.98]">
          Cobrar {cart.length > 0 && fmt(total)}
        </button>
      </div>
    </>
  );

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-slate-700 border-t-emerald-400 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-slate-400 hover:text-white text-sm flex items-center gap-1.5">
            <span className="text-lg leading-none">‹</span> Salir
          </button>
          <div className="h-5 w-px bg-white/10" />
          <span className="font-semibold tracking-tight flex items-center gap-1.5">
            {vertical?.emoji ?? '🧾'} <span>Punto de venta</span>
          </span>
        </div>
        {live && (
          <div className="flex items-center gap-5 text-sm">
            <div className="text-right">
              <span className="text-slate-500 text-xs block leading-none">Ventas hoy</span>
              <span className="font-bold text-emerald-400">{fmt(live.revenue)}</span>
            </div>
            <div className="text-right hidden sm:block">
              <span className="text-slate-500 text-xs block leading-none">Tickets</span>
              <span className="font-semibold">{live.invoices}</span>
            </div>
            <div className="text-right hidden md:block">
              <span className="text-slate-500 text-xs block leading-none">Ticket prom.</span>
              <span className="font-semibold">{fmt(live.avgTicket)}</span>
            </div>
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-60" /><span className="rounded-full h-2 w-2 bg-emerald-400" /></span>
          </div>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Catálogo */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* búsqueda + categorías */}
          <div className="p-3 space-y-3 shrink-0">
            <input
              ref={searchRef}
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSearchEnter(); } }}
              placeholder="Buscar producto o escanear código…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-transparent"
            />
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {categories.map(cat => (
                <button key={cat} onClick={() => setActiveCat(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${activeCat === cat ? 'bg-white text-slate-900 font-semibold' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* grid */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {filtered.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                {loadError && products.length === 0 ? (
                  <>
                    <div className="text-5xl mb-3 opacity-40">⚠️</div>
                    <p className="text-sm mb-3">No pudimos cargar los productos.</p>
                    <button onClick={loadData} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
                      Reintentar
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-3 opacity-40">🔍</div>
                    <p className="text-sm">{products.length === 0 ? 'No tienes productos. Créalos en Productos.' : 'Sin resultados para tu búsqueda.'}</p>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {filtered.map(p => {
                  const c = tileColor(p);
                  return (
                    <button key={p.id} onClick={() => addToCart(p)}
                      className="group relative rounded-2xl overflow-hidden text-left aspect-[4/3] transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/40"
                      style={{ background: p.imageUrl ? undefined : `linear-gradient(135deg, ${c}, ${c}cc)` }}>
                      {p.imageUrl && <img src={p.imageUrl} alt={p.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute inset-0 p-2.5 flex flex-col justify-end">
                        <p className="text-white font-semibold text-sm leading-tight line-clamp-2 drop-shadow">{p.name}</p>
                        <p className="text-white/90 text-base font-bold mt-0.5 drop-shadow">{fmt(p.price)}</p>
                      </div>
                      {p.type === 'service' && <span className="absolute top-2 left-2 bg-white/20 backdrop-blur text-white text-[10px] px-1.5 py-0.5 rounded-full">Servicio</span>}
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/0 group-hover:bg-white/90 group-active:bg-white text-transparent group-hover:text-slate-900 flex items-center justify-center text-lg font-bold transition-all">+</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Ticket (carrito) — panel lateral solo en lg+ */}
        <aside className="hidden lg:flex w-[340px] xl:w-[380px] bg-white text-slate-900 flex-col shrink-0 border-l border-black/5">
          {ticketInner}
        </aside>
      </div>

      {/* Botón flotante "Ver ticket" — solo en pantallas pequeñas */}
      {itemCount > 0 && !ticketOpen && (
        <button onClick={() => setTicketOpen(true)}
          className="lg:hidden fixed bottom-4 inset-x-4 z-40 bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-2xl font-bold text-base shadow-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
          <span>Ver ticket ({itemCount})</span>
          <span className="opacity-70">·</span>
          <span>{fmt(total)}</span>
        </button>
      )}

      {/* Ticket como overlay full-screen en móvil */}
      {ticketOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-white text-slate-900">
          <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100 shrink-0">
            <span className="font-semibold">Ticket</span>
            <button onClick={() => setTicketOpen(false)} aria-label="Cerrar ticket" className="text-slate-400 hover:text-slate-700 text-2xl leading-none">✕</button>
          </div>
          {ticketInner}
        </div>
      )}

      {/* Panel de cobro */}
      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => !charging && setPayOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white text-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Cobrar {fmt(total)}</h3>
              <button onClick={() => setPayOpen(false)} aria-label="Cerrar cobro" className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_METHODS.map(([val, label, icon]) => (
                <button key={val} onClick={() => setPayMethod(val)}
                  className={`py-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-colors ${payMethod === val ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <span className="text-base leading-none">{icon}</span>{label}
                </button>
              ))}
            </div>

            {payMethod === 'cash' && (
              <div>
                <label className="text-xs text-slate-500 block mb-1">Efectivo recibido</label>
                <div className="flex gap-1.5 mb-2">
                  {[total, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000]
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map(v => <button key={v} onClick={() => setCashReceived(String(v))} className="flex-1 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 font-medium">{fmt(v)}</button>)}
                </div>
                <input type="number" autoFocus value={cashReceived} onChange={e => setCashReceived(e.target.value)} placeholder={String(Math.ceil(total))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-lg text-right font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                {cashN >= total && cashN > 0 && (
                  <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex justify-between">
                    <span className="text-sm text-emerald-700 font-medium">Cambio</span>
                    <span className="text-lg font-bold text-emerald-700">{fmt(change)}</span>
                  </div>
                )}
              </div>
            )}

            {vertical?.features.tip && (
              <div>
                <label className="text-xs text-slate-500 block mb-1">Propina</label>
                <div className="flex gap-1.5">
                  {[0, 5, 10, 15].map(pct => (
                    <button key={pct} onClick={() => setTipAmount(pct === 0 ? '' : String(Math.round((sub + tax) * pct / 100)))}
                      className="flex-1 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 font-medium">{pct === 0 ? 'Sin' : `${pct}%`}</button>
                  ))}
                </div>
              </div>
            )}

            {(payMethod === 'addi' || payMethod === 'credit_validation') && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700">
                Quedará como crédito pendiente de validación (no se marca pagada).
              </div>
            )}

            <button onClick={charge} disabled={charging || (payMethod === 'cash' && cashN < total)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white py-3.5 rounded-2xl font-bold text-lg transition-colors active:scale-[0.98]">
              {charging ? 'Procesando…' : `Confirmar ${fmt(total)}`}
            </button>
          </div>
        </div>
      )}

      {/* Venta completada */}
      {doneInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setDoneInfo(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white text-slate-900 w-full max-w-xs rounded-3xl p-6 text-center space-y-3 shadow-2xl">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-3xl">✓</div>
            <h3 className="font-bold text-lg">Venta registrada</h3>
            <p className="text-3xl font-extrabold text-slate-900">{fmt(doneInfo.total)}</p>
            {doneInfo.change > 0 && <p className="text-sm text-slate-500">Cambio: <span className="font-bold text-emerald-600">{fmt(doneInfo.change)}</span></p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setDoneInfo(null)} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-semibold">Nueva venta</button>
              <button onClick={() => router.push(`/invoices/${doneInfo.id}`)} className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-xl font-medium hover:bg-slate-50">Ver / imprimir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
