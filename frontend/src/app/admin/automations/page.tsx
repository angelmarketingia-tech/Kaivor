'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '@/components/AdminShell';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function AdminAutomations() {
  const [automations, setAutomations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    setLoading(true); setFailed(false);
    axios.get(`${API}/admin/automations`, { headers })
      .then(r => setAutomations(r.data.automations))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const run = async (id: string) => {
    setRunning(id);
    try {
      const res = await axios.post(`${API}/admin/automations`, { id }, { headers });
      setResults(r => ({ ...r, [id]: res.data }));
    } catch {
      setResults(r => ({ ...r, [id]: { summary: 'No se pudo ejecutar la automatización.', matches: [] } }));
    } finally { setRunning(null); }
  };

  return (
    <AdminShell>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Automatizaciones internas</h1>
        <p className="text-sm text-slate-500 mb-5">Procesos del equipo Kaivor que escanean todas las empresas de la plataforma.</p>

        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}</div>
        ) : failed ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-sm text-slate-600 mb-3">No pudimos cargar las automatizaciones.</p>
            <button onClick={load} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Reintentar</button>
          </div>
        ) : (
          <div className="space-y-3">
            {automations.map(a => {
              const res = results[a.id];
              return (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{a.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{a.desc}</p>
                    </div>
                    <button onClick={() => run(a.id)} disabled={running === a.id}
                      className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 disabled:opacity-50 shrink-0">
                      {running === a.id ? 'Ejecutando…' : 'Ejecutar'}
                    </button>
                  </div>
                  {res && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-700">{res.summary}</p>
                      {res.matches && res.matches.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {res.matches.map((m: any, i: number) => (
                            <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              {m.label}{m.detail ? ` · ${m.detail}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-slate-400 mt-4 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          Cada ejecución escanea los datos actuales y muestra las empresas que cumplen la condición. La ejecución programada automática se habilitará con Vercel Cron.
        </p>
      </div>
    </AdminShell>
  );
}
