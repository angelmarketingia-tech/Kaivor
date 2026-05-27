'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('es-CO', { dateStyle: 'medium' } as any) : '—';

export default function SupplierDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ kind: string; msg: string } | null>(null);
  const [showBalance, setShowBalance] = useState(false);
  const [bal, setBal] = useState({ description: '', amount: '', dueDate: '' });
  const [toast, setToast] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!token) { router.push('/auth/login'); return; }
    setLoading(true); setError(null);
    try {
      const res = await axios.get(`${API}/suppliers/${id}`, { headers });
      setData(res.data);
    } catch (err: any) {
      const s = err?.response?.status;
      if (s === 401) { router.push('/auth/login'); return; }
      if (s === 404) setError({ kind: 'notfound', msg: 'Este proveedor no existe.' });
      else setError({ kind: 'fail', msg: 'No pudimos cargar el proveedor.' });
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const addBalance = async () => {
    if (!bal.amount) { showToast('Ingresa el monto'); return; }
    try {
      await axios.patch(`${API}/suppliers/${id}`, { action: 'add-balance', ...bal }, { headers });
      showToast('Saldo registrado');
      setShowBalance(false); setBal({ description: '', amount: '', dueDate: '' });
      load();
    } catch { showToast('No se pudo registrar'); }
  };

  const markBalance = async (balanceId: string, status: string) => {
    try {
      await axios.patch(`${API}/suppliers/${id}`, { action: 'mark-balance', balanceId, status }, { headers });
      load();
    } catch { showToast('No se pudo actualizar'); }
  };

  const sendWhatsApp = () => {
    const s = data.supplier;
    if (!s.phone) { showToast('El proveedor no tiene teléfono'); return; }
    const phone = s.phone.replace(/\D/g, '');
    const formatted = phone.startsWith('57') ? phone : `57${phone}`;
    const msg = data.outstanding > 0
      ? `Hola ${s.name}, te escribimos sobre el saldo pendiente de ${fmt(data.outstanding)}.`
      : `Hola ${s.name}, te contactamos de nuestra empresa.`;
    window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) return (
    <AppLayout><div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div></AppLayout>
  );
  if (error) return (
    <AppLayout><div className="p-6 max-w-md mx-auto mt-16 text-center">
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <div className="text-4xl mb-3">{error.kind === 'notfound' ? '🔍' : '⚠️'}</div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">{error.msg}</h2>
        <div className="flex gap-2 justify-center mt-4">
          {error.kind === 'fail' && <button onClick={load} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Reintentar</button>}
          <Link href="/suppliers" className="border border-slate-200 px-4 py-2 rounded-lg text-sm">Volver</Link>
        </div>
      </div>
    </div></AppLayout>
  );
  if (!data) return null;

  const s = data.supplier;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {toast && <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">{toast}</div>}

        <div className="flex items-center gap-2 mb-4 text-sm">
          <Link href="/suppliers" className="text-slate-500 hover:text-slate-900">Proveedores</Link>
          <span className="text-slate-300">/</span><span className="text-slate-900 font-medium">{s.name}</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{s.name}</h1>
              <p className="text-sm text-slate-500">{s.category || 'Sin categoría'}</p>
              <div className="text-sm text-slate-500 mt-1 space-y-0.5">
                {s.taxId && <p>NIT: {s.taxId}</p>}
                {s.contactName && <p>Contacto: {s.contactName}</p>}
                {s.email && <p>{s.email}</p>}
                {s.phone && <p>{s.phone}</p>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Saldo pendiente</p>
              <p className={`text-2xl font-bold ${data.outstanding > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{fmt(data.outstanding)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
            <button onClick={sendWhatsApp} className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">💬 WhatsApp</button>
            <button onClick={() => s.email ? window.open(`mailto:${s.email}`) : showToast('Sin email registrado')}
              className="px-3 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200">✉ Email</button>
            <button onClick={() => setShowBalance(!showBalance)}
              className="px-3 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700">+ Registrar saldo</button>
          </div>
        </div>

        {showBalance && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Nuevo saldo pendiente</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="text" value={bal.description} onChange={e => setBal(b => ({ ...b, description: e.target.value }))}
                placeholder="Descripción" className="border border-slate-200 rounded-lg px-3 py-2 text-sm sm:col-span-1" />
              <input type="number" value={bal.amount} onChange={e => setBal(b => ({ ...b, amount: e.target.value }))}
                placeholder="Monto" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input type="date" value={bal.dueDate} onChange={e => setBal(b => ({ ...b, dueDate: e.target.value }))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <button onClick={addBalance} className="mt-3 bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
              Registrar
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Saldos y pagos</span>
          </div>
          {data.balances.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Sin saldos registrados.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.balances.map((b: any) => (
                <div key={b.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{b.description || 'Saldo'}</p>
                    <p className="text-xs text-slate-400">Vence {fmtDate(b.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${b.status === 'pending' ? 'text-amber-600' : 'text-slate-400'}`}>{fmt(b.amount)}</span>
                    {b.status === 'pending' ? (
                      <>
                        <button onClick={() => markBalance(b.id, 'paid')} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-100">Pagar</button>
                        <button onClick={() => markBalance(b.id, 'cancelled')} className="text-xs text-slate-400 hover:text-red-500">✕</button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">{b.status === 'paid' ? 'Pagado' : 'Cancelado'}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
