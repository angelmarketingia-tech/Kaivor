'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Customer { id: string; name: string; email?: string; phone?: string; taxId?: string }
interface Product { id: string; name: string; price: number; sku: string }
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

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    Promise.allSettled([
      axios.get(`${API}/subscriptions/usage`, { headers }),
      axios.get(`${API}/customers`, { headers }),
      axios.get(`${API}/products`, { headers }),
    ]).then(([usageRes, custRes, prodRes]) => {
      if (usageRes.status === 'fulfilled' && usageRes.value.data.invoices?.remaining <= 0) setLimitReached(true);
      if (custRes.status === 'fulfilled') setCustomers(custRes.value.data);
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.data);
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

  const totals = items.reduce((acc, item) => {
    const c = calcLine(item);
    return { sub: acc.sub + c.sub, disc: acc.disc + c.discAmt, tax: acc.tax + c.taxAmt, total: acc.total + c.total };
  }, { sub: 0, disc: 0, tax: 0, total: 0 });

  const cashAmt = parseFloat(cashReceived) || 0;
  const change = paymentMethod === 'cash' && cashAmt >= totals.total ? cashAmt - totals.total : 0;

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
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  if (limitReached) return (
    <AppLayout>
      <div className="flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-red-200 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Límite de facturas alcanzado</h2>
          <p className="text-slate-500 mb-6">Sube tu plan para seguir facturando sin límites.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/pricing" className="bg-violet-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-violet-700">Ver planes →</Link>
            <Link href="/invoices" className="border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-medium hover:bg-slate-50">Mis facturas</Link>
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
          <Link href="/invoices" className="text-slate-500 hover:text-slate-900">Facturas</Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-medium">Nueva factura</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Customer + Items */}
          <div className="lg:col-span-2 space-y-4">

            {/* Customer */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Cliente</h2>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{selectedCustomer.name}</p>
                    {selectedCustomer.email && <p className="text-xs text-slate-500">{selectedCustomer.email}</p>}
                    {selectedCustomer.phone && <p className="text-xs text-slate-500">{selectedCustomer.phone}</p>}
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-red-500 text-xs">Cambiar</button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Buscar cliente por nombre o email..."
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 mb-2"
                  />
                  {customerSearch && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {filteredCustomers.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-slate-500">No encontrado.</p>
                      ) : filteredCustomers.map(c => (
                        <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                          className="w-full text-left px-3 py-2.5 hover:bg-violet-50 transition-colors">
                          <p className="text-sm font-medium text-slate-900">{c.name}</p>
                          {c.email && <p className="text-xs text-slate-500">{c.email}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                  {customers.length === 0 && !customerSearch && (
                    <p className="text-sm text-slate-500">
                      No tienes clientes.{' '}
                      <Link href="/customers" className="text-violet-600 hover:underline">Crear cliente →</Link>
                    </p>
                  )}
                  {customers.length > 0 && !customerSearch && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {customers.slice(0, 5).map(c => (
                        <button key={c.id} onClick={() => setSelectedCustomer(c)}
                          className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors">
                          <p className="text-sm font-medium text-slate-900">{c.name}</p>
                          {c.email && <p className="text-xs text-slate-500">{c.email}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Products */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700">Productos / Servicios</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">IVA global:</span>
                  <button onClick={() => applyGlobalTax(0)}
                    className={`px-2 py-0.5 text-xs rounded font-medium ${globalTax === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>0%</button>
                  <button onClick={() => applyGlobalTax(19)}
                    className={`px-2 py-0.5 text-xs rounded font-medium ${globalTax === 19 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>19%</button>
                </div>
              </div>

              {/* Product search */}
              <div className="mb-3 relative">
                <input
                  type="text"
                  placeholder="Buscar producto del catálogo..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                {productSearch && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 divide-y divide-slate-100">
                    {filteredProducts.map(p => (
                      <button key={p.id} onClick={() => addProduct(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-violet-50 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{p.name}</p>
                          <p className="text-xs text-slate-500">{p.sku}</p>
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{fmt(p.price)}</span>
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
                      <div key={item.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-12 sm:col-span-5">
                            <input
                              type="text"
                              placeholder="Descripción"
                              value={item.description}
                              onChange={e => updateItem(item.id, 'description', e.target.value)}
                              className="w-full border border-slate-200 rounded px-2 py-1 text-sm bg-white"
                            />
                          </div>
                          <div className="col-span-3 sm:col-span-2">
                            <input type="number" min={1} step={1} value={item.quantity}
                              onChange={e => updateItem(item.id, 'quantity', Math.max(1, parseFloat(e.target.value) || 1))}
                              className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-center bg-white" placeholder="Cant" />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <input type="number" min={0} step={100} value={item.unitPrice}
                              onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-right bg-white" placeholder="Precio" />
                          </div>
                          <div className="col-span-3 sm:col-span-2">
                            <select value={item.taxRate}
                              onChange={e => updateItem(item.id, 'taxRate', parseFloat(e.target.value))}
                              className="w-full border border-slate-200 rounded px-1 py-1 text-xs bg-white">
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
                              className="border border-slate-200 rounded px-1 py-0.5 text-xs bg-white">
                              <option value="percent">Desc. %</option>
                              <option value="fixed">Desc. $</option>
                            </select>
                            <input type="number" min={0} step={item.discountType === 'percent' ? 1 : 100}
                              max={item.discountType === 'percent' ? 100 : undefined}
                              value={item.discountValue}
                              onChange={e => updateItem(item.id, 'discountValue', parseFloat(e.target.value) || 0)}
                              className="w-16 border border-slate-200 rounded px-2 py-0.5 text-xs text-right bg-white" />
                          </div>
                          <div className="text-right">
                            {c.discAmt > 0 && <p className="text-xs text-emerald-600">-{fmt(c.discAmt)}</p>}
                            <p className="text-sm font-semibold text-slate-900">{fmt(c.total)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button onClick={addCustomItem}
                className="w-full border-2 border-dashed border-slate-200 rounded-lg py-2.5 text-sm text-slate-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                + Agregar ítem personalizado
              </button>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Notas (opcional)</h2>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones para el cliente..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
            </div>
          </div>

          {/* Right: Summary + Payment */}
          <div className="space-y-4">
            {/* Totals */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Resumen</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{fmt(totals.sub)}</span></div>
                {totals.disc > 0 && <div className="flex justify-between text-emerald-600"><span>Descuento</span><span>-{fmt(totals.disc)}</span></div>}
                {totals.tax > 0 && <div className="flex justify-between"><span className="text-slate-500">IVA</span><span>{fmt(totals.tax)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t border-slate-100 pt-2 mt-2">
                  <span>TOTAL</span><span>{fmt(totals.total)}</span>
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Forma de pago</h2>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {([['cash','Efectivo'],['nequi','Nequi'],['daviplata','Daviplata'],
                   ['debit_card','T. Débito'],['credit_card','T. Crédito'],['qr','QR'],
                   ['bank_transfer','Transfer.'],['addi','Addi'],['credit_validation','Crédito']] as const).map(([val,label]) => (
                  <button key={val} onClick={() => setPaymentMethod(val)}
                    className={`py-2 text-xs rounded-lg border transition-colors ${paymentMethod === val ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {paymentMethod === 'cash' && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Valor recibido</label>
                    <input type="number" min={totals.total} value={cashReceived}
                      onChange={e => setCashReceived(e.target.value)}
                      placeholder={String(Math.ceil(totals.total))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
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
                  <label className="text-xs text-slate-500 block mb-1">Referencia / comprobante (opcional)</label>
                  <input type="text" value={paymentReference} onChange={e => setPaymentReference(e.target.value)}
                    placeholder={paymentMethod === 'qr' ? 'Referencia del QR' : paymentMethod.includes('card') ? 'Últimos 4 dígitos o autorización' : 'N° de transacción'}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  <p className="text-xs text-slate-400 mt-1.5">Se registrará como pago operativo confirmado.</p>
                </div>
              )}

              {(paymentMethod === 'addi' || paymentMethod === 'credit_validation') && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Número de cuotas</label>
                    <input type="number" min={1} value={installments} onChange={e => setInstallments(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
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
            <p className="text-xs text-center text-slate-400">
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
