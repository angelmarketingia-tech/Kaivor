'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-CO', { dateStyle: 'medium' } as any);

interface Customer { id: string; name: string; email?: string; phone?: string; taxId?: string; address?: string; city?: string; vip: boolean; status: string }
interface Stats { totalBought: number; invoiceCount: number; lastPurchase: string | null; daysSinceLastPurchase: number | null; churnRisk: string; overdueCount: number; overdueAmount: number; avgTicket: number }
interface Inv { id: string; invoiceNumber: string; total: number; status: string; paymentStatus: string; createdAt: string }
interface Msg { id: string; channel: string; destination: string; message: string; status: string; sentAt: string }
interface Note { id: string; body: string; authorName?: string; createdAt: string }
interface Prod { name: string; qty: number; total: number }

const RISK: Record<string, { label: string; cls: string }> = {
  nuevo: { label: 'Cliente nuevo', cls: 'bg-blue-100 text-blue-700' },
  bajo: { label: 'Riesgo bajo', cls: 'bg-emerald-100 text-emerald-700' },
  medio: { label: 'Riesgo medio', cls: 'bg-amber-100 text-amber-700' },
  alto: { label: 'Riesgo de abandono alto', cls: 'bg-red-100 text-red-700' },
};

type Tab = 'resumen' | 'facturas' | 'mensajes' | 'notas';

export default function Customer360Page() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ kind: 'notfound' | 'forbidden' | 'fail'; msg: string } | null>(null);
  const [tab, setTab] = useState<Tab>('resumen');
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!token) { router.push('/auth/login'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API}/customers/${id}`, { headers });
      setData(res.data);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) { router.push('/auth/login'); return; }
      if (status === 404) setError({ kind: 'notfound', msg: 'Este cliente no existe o fue eliminado.' });
      else if (status === 403) setError({ kind: 'forbidden', msg: 'No tienes permiso para ver este cliente.' });
      else setError({ kind: 'fail', msg: 'No pudimos cargar el cliente. Revisa tu conexión e intenta de nuevo.' });
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const customer: Customer = data?.customer;
  const stats: Stats = data?.stats;

  const toggleVip = async () => {
    try {
      const res = await axios.patch(`${API}/customers/${id}`, { vip: !customer.vip }, { headers });
      setData((d: any) => ({ ...d, customer: { ...d.customer, vip: res.data.vip } }));
      showToast(res.data.vip ? 'Cliente marcado como VIP.' : 'Marca VIP retirada.', 'ok');
    } catch { showToast('No pudimos actualizar el cliente.', 'err'); }
  };

  const toggleStatus = async () => {
    const next = customer.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await axios.patch(`${API}/customers/${id}`, { status: next }, { headers });
      setData((d: any) => ({ ...d, customer: { ...d.customer, status: res.data.status } }));
      showToast(next === 'inactive' ? 'Cliente marcado como inactivo.' : 'Cliente reactivado.', 'ok');
    } catch { showToast('No pudimos actualizar el cliente.', 'err'); }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await axios.post(`${API}/customers/${id}/notes`, { body: noteText }, { headers });
      setData((d: any) => ({ ...d, notes: [res.data, ...d.notes] }));
      setNoteText('');
      showToast('Nota agregada.', 'ok');
    } catch { showToast('No pudimos guardar la nota.', 'err'); }
    finally { setSavingNote(false); }
  };

  const sendWhatsApp = () => {
    if (!customer.phone) { showToast('El cliente no tiene teléfono. Agrega uno para enviar WhatsApp.', 'err'); return; }
    const phone = customer.phone.replace(/\D/g, '');
    const formatted = phone.startsWith('57') ? phone : `57${phone}`;
    const msg = encodeURIComponent(`Hola ${customer.name}, te escribimos de tu empresa de confianza. ¿En qué podemos ayudarte hoy?`);
    window.open(`https://wa.me/${formatted}?text=${msg}`, '_blank');
    axios.post(`${API}/messages`, { channel: 'whatsapp', customerId: id, destination: formatted, message: decodeURIComponent(msg) }, { headers }).catch(() => {});
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
          <div className="text-4xl mb-3">{error.kind === 'notfound' ? '🔍' : error.kind === 'forbidden' ? '🔒' : '⚠️'}</div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            {error.kind === 'notfound' ? 'Cliente no encontrado' : error.kind === 'forbidden' ? 'Acceso denegado' : 'No pudimos cargar el cliente'}
          </h2>
          <p className="text-sm text-slate-500 mb-5">{error.msg}</p>
          <div className="flex gap-2 justify-center">
            {error.kind === 'fail' && (
              <button onClick={load} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700">
                Reintentar
              </button>
            )}
            <Link href="/customers" className="border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
              Volver a clientes
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
  if (!data) return null;

  const risk = RISK[stats.churnRisk] ?? RISK.bajo;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.msg}
          </div>
        )}

        <div className="flex items-center gap-2 mb-4 text-sm">
          <Link href="/customers" className="text-slate-500 hover:text-slate-900">Clientes</Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-medium">{customer.name}</span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
                {customer.vip && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">★ VIP</span>}
                {customer.status === 'inactive' && <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-medium">Inactivo</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${risk.cls}`}>{risk.label}</span>
              </div>
              <div className="text-sm text-slate-500 mt-1 space-y-0.5">
                {customer.email && <p>{customer.email}</p>}
                {customer.phone && <p>{customer.phone}</p>}
                {customer.taxId && <p>NIT/CC: {customer.taxId}</p>}
                {(customer.address || customer.city) && <p>{[customer.address, customer.city].filter(Boolean).join(', ')}</p>}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
            <Link href="/invoices/create" className="px-3 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700">+ Crear factura</Link>
            <button onClick={sendWhatsApp} className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">💬 WhatsApp</button>
            <button onClick={toggleVip} className="px-3 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200">
              {customer.vip ? 'Quitar VIP' : '★ Marcar VIP'}
            </button>
            <button onClick={toggleStatus} className="px-3 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200">
              {customer.status === 'active' ? 'Marcar inactivo' : 'Reactivar'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase">Total comprado</p>
            <p className="text-lg font-bold text-slate-900">{fmt(stats.totalBought)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase">Facturas</p>
            <p className="text-lg font-bold text-slate-900">{stats.invoiceCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase">Ticket promedio</p>
            <p className="text-lg font-bold text-slate-900">{fmt(stats.avgTicket)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase">Última compra</p>
            <p className="text-lg font-bold text-slate-900">
              {stats.daysSinceLastPurchase === null ? '—' : `${stats.daysSinceLastPurchase}d`}
            </p>
          </div>
        </div>

        {/* AI next action */}
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl border border-violet-100 p-4 mb-4">
          <p className="text-xs text-violet-600 uppercase tracking-wide font-medium mb-1">✦ Próxima acción recomendada</p>
          <p className="text-sm text-violet-800">{data.nextAction}</p>
        </div>

        {stats.overdueCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-medium text-red-800">{stats.overdueCount} factura(s) vencida(s) — {fmt(stats.overdueAmount)}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1 w-fit">
          {(['resumen', 'facturas', 'mensajes', 'notas'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'resumen' && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Productos comprados</h2>
            {data.productsBought.length === 0 ? (
              <p className="text-sm text-slate-400">Sin compras registradas.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.productsBought.map((p: Prod, i: number) => (
                  <div key={i} className="flex justify-between py-2">
                    <span className="text-sm text-slate-700">{p.name} <span className="text-slate-400">×{p.qty}</span></span>
                    <span className="text-sm font-medium text-slate-900">{fmt(p.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'facturas' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {data.invoices.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Sin facturas.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.invoices.map((inv: Inv) => (
                  <Link key={inv.id} href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-medium text-violet-700">{inv.invoiceNumber}</p>
                      <p className="text-xs text-slate-400">{fmtDate(inv.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{fmt(inv.total)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${inv.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {inv.paymentStatus === 'paid' ? 'Pagada' : 'Pendiente'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'mensajes' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {data.messages.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Sin mensajes enviados.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.messages.map((m: Msg) => (
                  <div key={m.id} className="px-5 py-3 flex items-start gap-3">
                    <span className="text-lg">{m.channel === 'whatsapp' ? '💬' : '✉️'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500">{m.destination}</p>
                      <p className="text-sm text-slate-700 line-clamp-2">{m.message}</p>
                    </div>
                    <p className="text-xs text-slate-400">{fmtDate(m.sentAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'notas' && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex gap-2 mb-4">
              <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNote()}
                placeholder="Escribe una nota sobre este cliente…"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <button onClick={addNote} disabled={savingNote || !noteText.trim()}
                className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-40">
                Agregar
              </button>
            </div>
            {data.notes.length === 0 ? (
              <p className="text-sm text-slate-400">Sin notas aún.</p>
            ) : (
              <div className="space-y-2">
                {data.notes.map((n: Note) => (
                  <div key={n.id} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-sm text-slate-700">{n.body}</p>
                    <p className="text-xs text-slate-400 mt-1">{n.authorName || 'Usuario'} · {fmtDate(n.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
