'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '@/components/AdminShell';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmtDate = (d: string) => new Date(d).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' } as any);

const STATUS_CLS: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700', in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700', closed: 'bg-slate-100 text-slate-500',
};
const PRIO_CLS: Record<string, string> = {
  high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-slate-100 text-slate-600',
};

export default function AdminSupport() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<any>(null);
  const [response, setResponse] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    setLoading(true); setFailed(false);
    axios.get(`${API}/admin/support${status !== 'all' ? `?status=${status}` : ''}`, { headers })
      .then(r => { setTickets(r.data.tickets); setCounts(r.data.counts); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [status]);

  const update = async (id: string, patch: any) => {
    try {
      await axios.patch(`${API}/admin/support`, { id, ...patch }, { headers });
      setSelected(null); setResponse('');
      load();
    } catch { /* noop */ }
  };

  return (
    <AdminShell>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Soporte y tickets</h1>
        <p className="text-sm text-slate-500 mb-4">
          Abiertos: {counts.open ?? 0} · En proceso: {counts.in_progress ?? 0} · Resueltos: {counts.resolved ?? 0}
        </p>

        <div className="flex gap-1 mb-4 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium ${status === s ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
              {s === 'all' ? 'Todos' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-slate-50 animate-pulse rounded" />)}</div>
          ) : failed ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-600 mb-3">No pudimos cargar los tickets.</p>
              <button onClick={load} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Reintentar</button>
            </div>
          ) : tickets.length === 0 ? (
            <p className="p-10 text-center text-slate-400 text-sm">Sin tickets de soporte.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {tickets.map(t => (
                <button key={t.id} onClick={() => { setSelected(t); setResponse(t.response || ''); }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{t.subject}</p>
                    <p className="text-xs text-slate-400">{t.reporterName || 'Usuario'} · {t.category} · {fmtDate(t.createdAt)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${PRIO_CLS[t.priority]}`}>{t.priority}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[t.status]}`}>{t.status.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
            <div className="bg-white rounded-xl p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-slate-900">{selected.subject}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{selected.reporterName || 'Usuario'} · {selected.category} · {fmtDate(selected.createdAt)}</p>
              <p className="text-sm text-slate-700 mt-3 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{selected.description}</p>

              <label className="text-xs text-slate-500 block mt-3 mb-1">Respuesta interna</label>
              <textarea rows={3} value={response} onChange={e => setResponse(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />

              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={() => update(selected.id, { status: 'in_progress', response })}
                  className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100">En proceso</button>
                <button onClick={() => update(selected.id, { status: 'resolved', response })}
                  className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-100">Resolver</button>
                <button onClick={() => update(selected.id, { status: 'closed', response })}
                  className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200">Cerrar</button>
                <button onClick={() => setSelected(null)} className="text-xs border border-slate-200 px-3 py-1.5 rounded-lg ml-auto">Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
