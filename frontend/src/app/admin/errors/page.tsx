'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '@/components/AdminShell';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmtDate = (d: string) => new Date(d).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' } as any);

const SEV: Record<string, string> = {
  critical: 'bg-red-100 text-red-700', error: 'bg-orange-100 text-orange-700',
  warning: 'bg-amber-100 text-amber-700', info: 'bg-slate-100 text-slate-600',
};

export default function AdminErrors() {
  const [errors, setErrors] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<any>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    setLoading(true); setFailed(false);
    axios.get(`${API}/admin/errors${status !== 'all' ? `?status=${status}` : ''}`, { headers })
      .then(r => { setErrors(r.data.errors); setCounts(r.data.counts); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [status]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await axios.patch(`${API}/admin/errors`, { id, status: newStatus }, { headers });
      setSelected(null);
      load();
    } catch { /* noop */ }
  };

  return (
    <AdminShell>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Central de errores</h1>
        <p className="text-sm text-slate-500 mb-4">
          Abiertos: {counts.open ?? 0} · Investigando: {counts.investigating ?? 0} · Resueltos: {counts.resolved ?? 0}
        </p>

        <div className="flex gap-1 mb-4 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {['all', 'open', 'investigating', 'resolved', 'ignored'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium ${status === s ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
              {s === 'all' ? 'Todos' : s}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-slate-50 animate-pulse rounded" />)}</div>
          ) : failed ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-600 mb-3">No pudimos cargar los errores.</p>
              <button onClick={load} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Reintentar</button>
            </div>
          ) : errors.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-3xl mb-2">✓</div>
              <p className="text-sm text-slate-600">Sin errores registrados.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {errors.map(e => (
                <button key={e.id} onClick={() => setSelected(e)} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-start gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${SEV[e.severity] ?? SEV.info}`}>{e.severity}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 truncate">{e.message}</p>
                    <p className="text-xs text-slate-400">{e.source} · {e.path || 'sin ruta'} · {fmtDate(e.createdAt)}</p>
                  </div>
                  <span className="text-xs text-slate-400">{e.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
            <div className="bg-white rounded-xl p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <span className={`text-xs px-2 py-0.5 rounded-full ${SEV[selected.severity] ?? SEV.info}`}>{selected.severity}</span>
              <h3 className="text-base font-semibold text-slate-900 mt-2">{selected.message}</h3>
              <p className="text-xs text-slate-400 mt-1">{selected.source} · {fmtDate(selected.createdAt)}</p>
              {selected.path && <p className="text-xs text-slate-500 mt-1">Ruta: {selected.path}</p>}
              {selected.stack && (
                <pre className="text-xs bg-slate-50 rounded-lg p-3 mt-3 overflow-x-auto text-slate-600 whitespace-pre-wrap">{selected.stack}</pre>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                {['investigating', 'resolved', 'ignored'].map(s => (
                  <button key={s} onClick={() => updateStatus(selected.id, s)}
                    className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 capitalize">
                    Marcar {s}
                  </button>
                ))}
                <button onClick={() => setSelected(null)} className="text-xs border border-slate-200 px-3 py-1.5 rounded-lg ml-auto">Cerrar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
