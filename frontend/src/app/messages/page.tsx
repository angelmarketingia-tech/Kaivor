'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmtDate = (d: string) => new Date(d).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

interface MessageLog {
  id: string;
  channel: string;
  destination: string;
  subject: string | null;
  message: string;
  status: string;
  sentAt: string;
}
interface Customer { id: string; name: string; email?: string; phone?: string }
interface Template { id: string; channel: string; name: string; subject: string | null; body: string }

const STATUS_CLS: Record<string, string> = {
  sent: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  draft: 'bg-slate-100 text-slate-500',
};

export default function MessagesPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'whatsapp' | 'email'>('all');
  const [composing, setComposing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // compose state
  const [cChannel, setCChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [cCustomer, setCCustomer] = useState<Customer | null>(null);
  const [cTemplate, setCTemplate] = useState<Template | null>(null);
  const [cSubject, setCSubject] = useState('');
  const [cMessage, setCMessage] = useState('');
  const [sending, setSending] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    Promise.allSettled([
      axios.get(`${API}/messages`, { headers }),
      axios.get(`${API}/customers`, { headers }),
      axios.get(`${API}/messages/templates`, { headers }),
    ]).then(([mRes, cRes, tRes]) => {
      if (mRes.status === 'fulfilled') setLogs(mRes.value.data);
      if (cRes.status === 'fulfilled') setCustomers(cRes.value.data);
      if (tRes.status === 'fulfilled') setTemplates(tRes.value.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    load();
  }, []);

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const subst = (text: string) => text
    .replace(/{cliente}/g, cCustomer?.name || 'Cliente')
    .replace(/{numeroFactura}/g, '—')
    .replace(/{total}/g, '—')
    .replace(/{linkFactura}/g, 'https://kaivor.vercel.app')
    .replace(/{empresa}/g, 'tu empresa');

  const pickTemplate = (t: Template | null) => {
    setCTemplate(t);
    if (t) {
      setCMessage(subst(t.body));
      if (t.subject) setCSubject(subst(t.subject));
    }
  };

  const send = async () => {
    if (!cCustomer) { showToast('Selecciona un cliente.', 'err'); return; }
    if (!cMessage.trim()) { showToast('Escribe un mensaje.', 'err'); return; }
    const destination = cChannel === 'whatsapp' ? cCustomer.phone : cCustomer.email;
    if (!destination) {
      showToast(cChannel === 'whatsapp' ? 'El cliente no tiene teléfono.' : 'El cliente no tiene email.', 'err');
      return;
    }
    setSending(true);
    try {
      const res = await axios.post(`${API}/messages`, {
        channel: cChannel, customerId: cCustomer.id, destination,
        subject: cChannel === 'email' ? cSubject : undefined, message: cMessage,
      }, { headers });
      if (cChannel === 'whatsapp' && res.data.waUrl) {
        window.open(res.data.waUrl, '_blank');
      }
      showToast(cChannel === 'whatsapp' ? 'WhatsApp abierto. Mensaje registrado.' : 'Correo enviado correctamente.', 'ok');
      setComposing(false);
      setCCustomer(null); setCTemplate(null); setCMessage(''); setCSubject('');
      load();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'No pudimos enviar el mensaje.', 'err');
    } finally { setSending(false); }
  };

  const filtered = filter === 'all' ? logs : logs.filter(l => l.channel === filter);
  const channelTemplates = templates.filter(t => t.channel === cChannel);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.msg}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mensajes</h1>
            <p className="text-sm text-slate-500 mt-0.5">Historial de comunicaciones con tus clientes.</p>
          </div>
          <button onClick={() => setComposing(true)}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700">
            + Nuevo mensaje
          </button>
        </div>

        {/* Filter */}
        <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1 w-fit">
          {(['all', 'whatsapp', 'email'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {f === 'all' ? 'Todos' : f === 'whatsapp' ? 'WhatsApp' : 'Email'}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="space-y-px">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-50 animate-pulse border-b border-slate-100" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="text-4xl mb-3 opacity-30">📨</div>
              <p className="text-slate-600 font-medium mb-1">Sin mensajes aún</p>
              <p className="text-sm text-slate-400 mb-4">Envía tu primera factura o recordatorio por WhatsApp o email.</p>
              <button onClick={() => setComposing(true)}
                className="bg-slate-900 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-slate-700">
                Enviar mensaje →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map(log => (
                <div key={log.id} className="px-5 py-3.5 flex items-start gap-3">
                  <span className="text-xl mt-0.5">{log.channel === 'whatsapp' ? '💬' : log.channel === 'email' ? '✉️' : '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{log.destination}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[log.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {log.status === 'sent' ? 'Enviado' : log.status === 'failed' ? 'Falló' : log.status}
                      </span>
                    </div>
                    {log.subject && <p className="text-xs font-medium text-slate-600 mt-0.5">{log.subject}</p>}
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{log.message}</p>
                  </div>
                  <p className="text-xs text-slate-400 whitespace-nowrap">{fmtDate(log.sentAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Compose modal */}
        {composing && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setComposing(false)}>
            <div className="bg-white rounded-xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Nuevo mensaje</h3>

              {/* Channel */}
              <div className="flex gap-2 mb-3">
                {(['whatsapp', 'email'] as const).map(ch => (
                  <button key={ch} onClick={() => { setCChannel(ch); setCTemplate(null); }}
                    className={`flex-1 py-2 text-sm rounded-lg border ${cChannel === ch ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}>
                    {ch === 'whatsapp' ? '💬 WhatsApp' : '✉️ Email'}
                  </button>
                ))}
              </div>

              {/* Customer */}
              <label className="text-xs text-slate-500 block mb-1">Cliente</label>
              <select value={cCustomer?.id || ''} onChange={e => setCCustomer(customers.find(c => c.id === e.target.value) || null)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
                <option value="">Selecciona un cliente…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {cCustomer && (
                <p className="text-xs text-slate-400 -mt-2 mb-3">
                  {cChannel === 'whatsapp'
                    ? (cCustomer.phone ? `WhatsApp: ${cCustomer.phone}` : '⚠ Sin teléfono registrado')
                    : (cCustomer.email ? `Email: ${cCustomer.email}` : '⚠ Sin email registrado')}
                </p>
              )}

              {/* Template */}
              {channelTemplates.length > 0 && (
                <>
                  <label className="text-xs text-slate-500 block mb-1">Plantilla (opcional)</label>
                  <select value={cTemplate?.id || ''} onChange={e => pickTemplate(channelTemplates.find(t => t.id === e.target.value) || null)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
                    <option value="">Sin plantilla</option>
                    {channelTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </>
              )}

              {cChannel === 'email' && (
                <>
                  <label className="text-xs text-slate-500 block mb-1">Asunto</label>
                  <input type="text" value={cSubject} onChange={e => setCSubject(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3" />
                </>
              )}

              <label className="text-xs text-slate-500 block mb-1">Mensaje</label>
              <textarea rows={4} value={cMessage} onChange={e => setCMessage(e.target.value)}
                placeholder="Escribe tu mensaje…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none mb-3" />

              <div className="flex gap-2">
                <button onClick={send} disabled={sending}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                  {sending ? 'Enviando…' : cChannel === 'whatsapp' ? 'Abrir WhatsApp' : 'Enviar email'}
                </button>
                <button onClick={() => setComposing(false)}
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
