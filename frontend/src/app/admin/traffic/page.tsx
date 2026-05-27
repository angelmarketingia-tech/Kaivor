'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '@/components/AdminShell';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function AdminTraffic() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true); setError(false);
    const token = localStorage.getItem('token');
    axios.get(`${API}/admin/traffic`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const maxDaily = data ? Math.max(1, ...data.daily.map((d: any) => d.count)) : 1;
  const maxFunnel = data ? Math.max(1, ...data.funnel.map((f: any) => f.count)) : 1;

  return (
    <AdminShell>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Tráfico y analytics</h1>
        <p className="text-sm text-slate-500 mb-5">Eventos de uso de los últimos 30 días.</p>

        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-white rounded-xl animate-pulse" />)}</div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-sm text-slate-600 mb-3">No pudimos cargar el tráfico.</p>
            <button onClick={load} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Reintentar</button>
          </div>
        ) : data && (
          <div className="space-y-5">
            {/* Funnel */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Embudo de conversión</h2>
              <div className="space-y-2">
                {data.funnel.map((f: any) => (
                  <div key={f.step} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-36 shrink-0">{f.step}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                      <div className="h-5 bg-violet-500 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(6, (f.count / maxFunnel) * 100)}%` }}>
                        <span className="text-xs text-white font-medium">{f.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily events */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Eventos por día ({data.totalEvents} total)</h2>
              {data.daily.length === 0 ? (
                <p className="text-sm text-slate-400">Sin eventos registrados aún.</p>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {data.daily.map((d: any) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="w-full bg-violet-400 rounded-t hover:bg-violet-600 transition-colors"
                        style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: '2px' }} />
                      <span className="text-[8px] text-slate-400">{d.date.slice(8)}</span>
                      <span className="absolute -top-5 text-[10px] bg-slate-900 text-white px-1 rounded opacity-0 group-hover:opacity-100">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top paths + breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Rutas más vistas</h2>
                {data.topPaths.length === 0 ? <p className="text-sm text-slate-400">Sin datos.</p> : (
                  <div className="space-y-1.5">
                    {data.topPaths.map((p: any) => (
                      <div key={p.path} className="flex justify-between text-sm">
                        <span className="text-slate-600 truncate">{p.path}</span>
                        <span className="text-slate-900 font-medium">{p.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Tipos de evento</h2>
                <div className="space-y-1.5">
                  {Object.entries(data.eventBreakdown).sort((a: any, b: any) => b[1] - a[1]).map(([name, count]: any) => (
                    <div key={name} className="flex justify-between text-sm">
                      <span className="text-slate-600">{name}</span>
                      <span className="text-slate-900 font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
