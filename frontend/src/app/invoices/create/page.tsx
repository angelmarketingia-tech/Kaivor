'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Customer { id: string; name: string; email?: string; phone?: string; taxId?: string }
interface Product { id: string; name: string; price: number; sku: string }
interface Vertical {
  id: string; label: string; emoji: string;
  features: { inventory: boolean; itemType: string; tip: boolean; serviceCharge: boolean; table: boolean; professional: boolean; duration: boolean; barcode: boolean };
  defaults: { unit: string; tipPercent: number; serviceChargePercent: number; itemNoun: string; customerNoun: string };
}
interface LineItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  taxRate: number;
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

function calcLine(item: LineItem) {
  const sub = item.quantity * item.unitPrice;
  const discAmt = item.discountType === 'percent' ? sub * (item.discountValue / 100) : item.discountValue;
  const taxable = sub - discAmt;
  const taxAmt = taxable * (item.taxRate / 100);
  return { sub, discAmt, taxAmt, total: taxable + taxAmt };
}

export default function CreateInvoicePage() {
  const router = useRouter();
  const submitRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [installments, setInstallments] = useState('1');
  const [notes, setNotes] = useState('');
  const [globalTax, setGlobalTax] = useState(0); // 0 or 19

  // Business vertical (adapta el POS: propina, mesa, profesional, etc.)
  const [vertical, setVertical] = useState<Vertical | null>(null);
  const [tipAmount, setTipAmount] = useState('');
  const [serviceCharge, setServiceCharge] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [professional, setProfessional] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    Promise.allSettled([
      axios.get(`${API}/subscriptions/usage`, { headers }),
      axios.get(`${API}/customers`, { headers }),
      axios.get(`${API}/products`, { headers }),
      axios.get(`${API}/companies/my`, { headers }),
    ]).then(([usageRes, custRes, prodRes, compRes]) => {
      if (usageRes.status === 'fulfilled' && usageRes.value.data.invoices?.remaining <= 0) setLimitReached(true);
      if (custRes.status === 'fulfilled') setCustomers(custRes.value.data);
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.data);
      if (compRes.status === 'fulfilled' && compRes.value.data?.vertical) setVertical(compRes.value.data.vertical);
    }).finally(() => setLoading(false));
  }, []);

  const addProduct = (p: Product) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === p.id);
      if (existing) {
        return prev.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: crypto.randomUUID(), productId: p.id, description: p.name,
        quantity: 1, unitPrice: p.price, discountType: 'percent', discountValue: 0, taxRate: globalTax,
      }];
    });
    setProductSearch('');
  };

  const addCustomItem = () => {
    setItems(prev => [...prev, {
      id: crypto.randomUUID(), description: '', quantity: 1,
      unitPrice: 0, discountType: 'percent', discountValue: 0, taxRate: globalTax,
    }]);
  };

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const applyGlobalTax = (rate: number) => {
    setGlobalTax(rate);
    setItems(prev => prev.map(i => ({ ...i, taxRate: rate })));
  };

  const baseTotals = items.reduce((acc, item) => {
    const c = calcLine(item);
    return { sub: acc.sub + c.sub, disc: acc.disc + c.discAmt, tax: acc.tax + c.taxAmt, total: acc.total + c.total };
  }, { sub: 0, disc: 0, tax: 0, total: 0 });

  const tipAmt = Math.max(0, parseFloat(tipAmount) || 0);
  const svcAmt = Math.max(0, parseFloat(serviceCharge) || 0);
  const totals = { ...baseTotals, tip: tipAmt, svc: svcAmt, total: baseTotals.total + tipAmt + svcAmt };

  const cashAmt = parseFloat(cashReceived) || 0;
  const change = paymentMethod === 'cash' && cashAmt >= totals.total ? cashAmt - totals.total : 0;

  // Helpers para sugerir propina/servicio según % de la vertical (sobre el total base con IVA).
  const suggestTip = (pct: number) => setTipAmount(String(Math.round(baseTotals.total * (pct / 100))));

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(customerSearch.toLowerCase())
  ).slice(0, 8);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 6);

  const handleCreate = async () => {
    if (submitRef.current || saving) return;
    if (!selectedCustomer) { alert('Selecciona un cliente'); return; }
    if (items.length === 0) { alert('Agrega al menos un producto'); return; }
    if (items.some(i => !i.description.trim())) { alert('Todos los ítems deben tener descripción'); return; }
    if (items.some(i => i.unitPrice <= 0)) { alert('Todos los precios deben ser mayores a 0'); return; }
    if (paymentMethod === 'cash' && cashAmt < totals.total) { alert(`Valor recibido (${fmt(cashAmt)}) es menor al total (${fmt(totals.total)})`); return; }

    submitRef.current = true;
    setSaving(true);
    try {
      const res = await axios.post(`${API}/invoices`, {
        customerId: selectedCustomer.id,
        items: items.map(i => ({
          productId: i.productId,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountType: i.discountType,
          discountValue: i.discountValue,
          taxRate: i.taxRate,
        })),
        paymentMethod,
        cashReceived: paymentMethod === 'cash' ? cashAmt : undefined,
        paymentReference: paymentReference || undefined,
        installments: Number(installments) || 1,
        tipAmount: tipAmt || undefined,
        serviceCharge: svcAmt || undefined,
        tableNumber: tableNumber || undefined,
        professional: professional || undefined,
        notes,
      }, { headers });
      router.push(`/invoices/${res.data.id}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'No pudimos crear la factura. Revisa los datos e inténtalo de nuevo.';
      if (msg.includes('Límite') || msg.includes('límite')) setLimitReached(true);
      else alert(msg);
      submitRef.current = false;
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-default border-t-brand rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  if (limitReached) return (
    <AppLayout>
      <div className="flex items-center justify-center p-6">
        <div className="surface rounded-xl border border-red-200 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-default mb-2">Límite de facturas alcanzado</h2>
          <p className="text-soft mb-6">Sube tu plan para seguir facturando sin límites.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/pricing" className="bg-brand text-ink-900 px-5 py-2.5 rounded-xl font-medium hover:bg-brand-300">Ver planes →</Link>
            <Link href="/invoices" className="border border-default text-default px-5 py-2.5 rounded-xl font-medium hover:bg-black/5 dark:hover:bg-white/5">Mis facturas</Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-5 text-sm">
          <Link href="/invoices" className="text-soft hover:text-default">Facturas</Link>
          <span className="text-soft">/</span>
          <span className="text-default font-medium">Nueva factura</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Customer + Items */}
          <div className="lg:col-span-2 space-y-4">

            {/* Customer */}
            <div className="surface rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-default mb-3">Cliente</h2>
              {selectedCustomer ? (
                <div className="flex items-center justify-between surface-2 rounded-lg px-4 py-3">
                  <div>
                    <p className="font-medium text-default text-sm">{selectedCustomer.name}</p>
                    {selectedCustomer.email && <p className="text-xs text-soft">{selectedCustomer.email}</p>}
                    {selectedCustomer.phone && <p className="text-xs text-soft">{selectedCustomer.phone}</p>}
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} className="text-soft hover:text-red-500 text-xs">Cambiar</button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Buscar cliente por nombre o email..."
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    className="w-full border border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand mb-2"
                  />
                  {customerSearch && (
                    <div className="border border-default rounded-lg overflow-hidden divide-y divide-default max-h-48 overflow-y-auto">
                      {filteredCustomers.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-soft">No encontrado.</p>
                      ) : filteredCustomers.map(c => (
                        <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                          className="w-full text-left px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <p className="text-sm font-medium text-default">{c.name}</p>
                          {c.email && <p className="text-xs text-soft">{c.email}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                  {customers.length === 0 && !customerSearch && (
                    <p className="text-sm text-soft">
                      No tienes clientes.{' '}
                      <Link href="/customers" className="text-brand hover:underline">Crear cliente →</Link>
                    </p>
                  )}
                  {customers.length > 0 && !customerSearch && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {customers.slice(0, 5).map(c => (
                        <button key={c.id} onClick={() => setSelectedCustomer(c)}
                          className="w-full text-left px-3 py-2 rounded-lg border border-default hover:border-brand hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <p className="text-sm font-medium text-default">{c.name}</p>
                          {c.email && <p className="text-xs text-soft">{c.email}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Contexto de la venta según vertical (mesa / profesional) */}
            {(vertical?.features.table || vertical?.features.professional) && (
              <div className="surface rounded-xl border p-5">
                <h2 className="text-sm font-semibold text-default mb-3">
                  {vertical.emoji} Detalles {vertical.label}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {vertical.features.table && (
                    <div>
                      <label className="text-xs text-soft block mb-1">Mesa</label>
                      <input type="text" value={tableNumber} onChange={e => setTableNumber(e.target.value)}
                        placeholder="Ej: 5" className="w-full border border-default rounded-lg px-3 py-2 text-sm" />
                    </div>
                  )}
                  {vertical.features.professional && (
                    <div>
                      <label className="text-xs text-soft block mb-1">
                        {vertical.id === 'health' ? 'Profesional / Médico' : vertical.id === 'automotive' ? 'Técnico' : 'Quién atiende'}
                      </label>
                      <input type="text" value={professional} onChange={e => setProfessional(e.target.value)}
                        placeholder="Nombre" className="w-full border border-default rounded-lg px-3 py-2 text-sm" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Products */}
            <div className="surface rounded-xl border p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-default">{vertical?.defaults.itemNoun || 'Productos / Servicios'}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-soft">IVA global:</span>
                  <button onClick={() => applyGlobalTax(0)}
                    className={`px-2 py-0.5 text-xs rounded font-medium ${globalTax === 0 ? 'bg-ink-900 text-white' : 'surface-2 text-soft hover:bg-black/5 dark:hover:bg-white/10'}`}>0%</button>
                  <button onClick={() => applyGlobalTax(19)}
                    className={`px-2 py-0.5 text-xs rounded font-medium ${globalTax === 19 ? 'bg-ink-900 text-white' : 'surface-2 text-soft hover:bg-black/5 dark:hover:bg-white/10'}`}>19%</button>
                </div>
              </div>

              {/* Product search */}
              <div className="mb-3 relative">
                <input
                  type="text"
                  placeholder="Buscar producto del catálogo..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full border border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand"
                />
                {productSearch && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 surface border rounded-lg shadow-lg mt-1 divide-y divide-default">
                    {filteredProducts.map(p => (
                      <button key={p.id} onClick={() => addProduct(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-default">{p.name}</p>
                          <p className="text-xs text-soft">{p.sku}</p>
                        </div>
                        <span className="text-sm font-semibold text-default">{fmt(p.price)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Items list */}
              {items.length > 0 && (
                <div className="space-y-3 mb-3">
                  {items.map(item => {
                    const c = calcLine(item);
                    return (
                      <div key={item.id} className="border border-default rounded-lg p-3 surface-2">
                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-12 sm:col-span-5">
                            <input
                              type="text"
                              placeholder="Descripción"
                              value={item.description}
                              onChange={e => updateItem(item.id, 'description', e.target.value)}
                              className="w-full border border-default rounded px-2 py-1 text-sm surface"
                            />
                          </div>
                          <div className="col-span-3 sm:col-span-2">
                            <input type="number" min={1} step={1} value={item.quantity}
                              onChange={e => updateItem(item.id, 'quantity', Math.max(1, parseFloat(e.target.value) || 1))}
                              className="w-full border border-default rounded px-2 py-1 text-sm text-center surface" placeholder="Cant" />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <input type="number" min={0} step={100} value={item.unitPrice}
                              onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full border border-default rounded px-2 py-1 text-sm text-right surface" placeholder="Precio" />
                          </div>
                          <div className="col-span-3 sm:col-span-2">
                            <select value={item.taxRate}
                              onChange={e => updateItem(item.id, 'taxRate', parseFloat(e.target.value))}
                              className="w-full border border-default rounded px-1 py-1 text-xs surface">
                              <option value={0}>0% IVA</option>
                              <option value={5}>5% IVA</option>
                              <option value={19}>19% IVA</option>
                            </select>
                          </div>
                          <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
                            <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <select value={item.discountType}
                              onChange={e => updateItem(item.id, 'discountType', e.target.value)}
                              className="border border-default rounded px-1 py-0.5 text-xs surface">
                              <option value="percent">Desc. %</option>
                              <option value="fixed">Desc. $</option>
                            </select>
                            <input type="number" min={0} step={item.discountType === 'percent' ? 1 : 100}
                              max={item.discountType === 'percent' ? 100 : undefined}
                              value={item.discountValue}
                              onChange={e => updateItem(item.id, 'discountValue', parseFloat(e.target.value) || 0)}
                              className="w-16 border border-default rounded px-2 py-0.5 text-xs text-right surface" />
                          </div>
                          <div className="text-right">
                            {c.discAmt > 0 && <p className="text-xs text-emerald-600">-{fmt(c.discAmt)}</p>}
                            <p className="text-sm font-semibold text-default">{fmt(c.total)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button onClick={addCustomItem}
                className="w-full border-2 border-dashed border-default rounded-lg py-2.5 text-sm text-soft hover:border-brand hover:text-brand hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                + Agregar ítem personalizado
              </button>
            </div>

            {/* Notes */}
            <div className="surface rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-default mb-2">Notas (opcional)</h2>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones para el cliente..."
                className="w-full border border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand resize-none" />
            </div>
          </div>

          {/* Right: Summary + Payment */}
          <div className="space-y-4">
            {/* Totals */}
            <div className="surface rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-default mb-4">Resumen</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-soft">Subtotal</span><span>{fmt(totals.sub)}</span></div>
                {totals.disc > 0 && <div className="flex justify-between text-emerald-600"><span>Descuento</span><span>-{fmt(totals.disc)}</span></div>}
                {totals.tax > 0 && <div className="flex justify-between"><span className="text-soft">IVA</span><span>{fmt(totals.tax)}</span></div>}
                {totals.svc > 0 && <div className="flex justify-between"><span className="text-soft">Servicio</span><span>{fmt(totals.svc)}</span></div>}
                {totals.tip > 0 && <div className="flex justify-between"><span className="text-soft">Propina</span><span>{fmt(totals.tip)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t border-default pt-2 mt-2">
                  <span>TOTAL</span><span>{fmt(totals.total)}</span>
                </div>
              </div>

              {/* Propina (verticales: restaurante/barbería/estética) */}
              {vertical?.features.tip && (
                <div className="mt-4 pt-3 border-t border-default">
                  <label className="text-xs font-medium text-default block mb-1.5">💵 Propina</label>
                  <div className="flex gap-1.5 mb-2">
                    {[0, 5, 10, 15].map(pct => (
                      <button key={pct} onClick={() => pct === 0 ? setTipAmount('') : suggestTip(pct)}
                        className="flex-1 py-1 text-xs rounded border border-default text-soft hover:bg-black/5 dark:hover:bg-white/5">
                        {pct === 0 ? 'Sin' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                  <input type="number" min={0} step={500} value={tipAmount} onChange={e => setTipAmount(e.target.value)}
                    placeholder="Monto propina" className="w-full border border-default rounded-lg px-3 py-1.5 text-sm" />
                </div>
              )}

              {/* Cargo por servicio (restaurante/hospitalidad) */}
              {vertical?.features.serviceCharge && (
                <div className="mt-3">
                  <label className="text-xs font-medium text-default block mb-1.5">Cargo por servicio</label>
                  <div className="flex gap-1.5 mb-2">
                    {[0, 8, 10].map(pct => (
                      <button key={pct} onClick={() => pct === 0 ? setServiceCharge('') : setServiceCharge(String(Math.round(baseTotals.total * (pct / 100))))}
                        className="flex-1 py-1 text-xs rounded border border-default text-soft hover:bg-black/5 dark:hover:bg-white/5">
                        {pct === 0 ? 'Sin' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                  <input type="number" min={0} step={500} value={serviceCharge} onChange={e => setServiceCharge(e.target.value)}
                    placeholder="Monto servicio" className="w-full border border-default rounded-lg px-3 py-1.5 text-sm" />
                </div>
              )}
            </div>

            {/* Payment */}
            <div className="surface rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-default mb-3">Forma de pago</h2>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {([['cash','Efectivo'],['nequi','Nequi'],['daviplata','Daviplata'],
                   ['debit_card','T. Débito'],['credit_card','T. Crédito'],['qr','QR'],
                   ['bank_transfer','Transfer.'],['addi','Addi'],['credit_validation','Crédito']] as const).map(([val,label]) => (
                  <button key={val} onClick={() => setPaymentMethod(val)}
                    className={`py-2 text-xs rounded-lg border transition-colors ${paymentMethod === val ? 'border-ink-900 bg-ink-900 text-white' : 'border-default text-soft hover:bg-black/5 dark:hover:bg-white/5'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {paymentMethod === 'cash' && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-soft block mb-1">Valor recibido</label>
                    <input type="number" min={totals.total} value={cashReceived}
                      onChange={e => setCashReceived(e.target.value)}
                      placeholder={String(Math.ceil(totals.total))}
                      className="w-full border border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-brand" />
                  </div>
                  {cashAmt >= totals.total && cashAmt > 0 && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 flex justify-between">
                      <span className="text-sm text-emerald-700">Cambio</span>
                      <span className="text-sm font-bold text-emerald-700">{fmt(change)}</span>
                    </div>
                  )}
                </div>
              )}

              {['nequi','daviplata','debit_card','credit_card','qr','bank_transfer'].includes(paymentMethod) && (
                <div>
                  <label className="text-xs text-soft block mb-1">Referencia / comprobante (opcional)</label>
                  <input type="text" value={paymentReference} onChange={e => setPaymentReference(e.target.value)}
                    placeholder={paymentMethod === 'qr' ? 'Referencia del QR' : paymentMethod.includes('card') ? 'Últimos 4 dígitos o autorización' : 'N° de transacción'}
                    className="w-full border border-default rounded-lg px-3 py-2 text-sm" />
                  <p className="text-xs text-soft mt-1.5">Se registrará como pago operativo confirmado.</p>
                </div>
              )}

              {(paymentMethod === 'addi' || paymentMethod === 'credit_validation') && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-soft block mb-1">Número de cuotas</label>
                    <input type="number" min={1} value={installments} onChange={e => setInstallments(e.target.value)}
                      className="w-full border border-default rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <p className="text-xs text-amber-700">
                      La factura quedará como <strong>crédito sujeto a validación</strong>: se crea sin marcar pagada y se registra una solicitud pendiente de aprobación.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Create button */}
            <button
              onClick={handleCreate}
              disabled={saving || !selectedCustomer || items.length === 0}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creando factura…
                </span>
              ) : 'Crear factura'}
            </button>
            <p className="text-xs text-center text-soft">
              {paymentMethod === 'addi' || paymentMethod === 'credit_validation'
                ? 'La factura quedará pendiente de validación de crédito.'
                : 'La factura se marcará como pagada y se registrará en tu historial.'}
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
