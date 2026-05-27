'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://kaivor-api.vercel.app';

type Check = {
  name: string;
  status: 'operational' | 'degraded' | 'outage' | 'checking';
  latencyMs?: number;
  detail?: string;
};

export default function StatusPage() {
  const [checks, setChecks] = useState<Check[]>([
    { name: 'API Backend', status: 'checking' },
    { name: 'Database', status: 'checking' },
    { name: 'Frontend (this page)', status: 'operational' },
  ]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  useEffect(() => {
    const run = async () => {
      const t0 = performance.now();
      try {
        const res = await fetch(`${API}/health`, { cache: 'no-store' });
        const latency = Math.round(performance.now() - t0);
        const data = await res.json();
        setChecks([
          {
            name: 'API Backend',
            status: res.ok ? 'operational' : 'outage',
            latencyMs: latency,
            detail: data.service ? `${data.service} v${data.version || '—'}` : undefined,
          },
          {
            name: 'Database',
            status: res.ok ? 'operational' : 'outage',
            detail: res.ok ? 'Neon PostgreSQL' : 'Connection failed',
          },
          { name: 'Frontend', status: 'operational', detail: 'Vercel Edge' },
        ]);
      } catch (e: any) {
        setChecks((cs) => cs.map((c) => (c.name === 'API Backend' ? { ...c, status: 'outage', detail: e.message } : c)));
      }
      setLastCheck(new Date());
    };
    run();
    const interval = setInterval(run, 30000);
    return () => clearInterval(interval);
  }, []);

  const allOperational = checks.every((c) => c.status === 'operational');

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Estado del servicio</h1>
          <p className="mt-1 text-sm text-slate-500">Kaivor / ADMIA</p>
        </header>

        <div
          className={`rounded-2xl p-6 mb-6 border ${
            allOperational
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${allOperational ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <h2 className="text-lg font-semibold">
              {allOperational ? 'Todos los sistemas operativos' : 'Algunos sistemas con problemas'}
            </h2>
          </div>
          <p className="mt-1 text-sm opacity-75">
            {lastCheck ? `Última verificación: ${lastCheck.toLocaleTimeString('es-CO')}` : 'Verificando...'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {checks.map((c, idx) => (
            <div
              key={c.name}
              className={`flex items-center justify-between p-5 ${
                idx > 0 ? 'border-t border-slate-100' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    c.status === 'operational'
                      ? 'bg-emerald-500'
                      : c.status === 'degraded'
                      ? 'bg-amber-500'
                      : c.status === 'outage'
                      ? 'bg-red-500'
                      : 'bg-slate-300 animate-pulse'
                  }`}
                />
                <div>
                  <p className="font-medium text-slate-900">{c.name}</p>
                  {c.detail && <p className="text-xs text-slate-500 mt-0.5">{c.detail}</p>}
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`text-sm font-medium ${
                    c.status === 'operational'
                      ? 'text-emerald-700'
                      : c.status === 'degraded'
                      ? 'text-amber-700'
                      : c.status === 'outage'
                      ? 'text-red-700'
                      : 'text-slate-400'
                  }`}
                >
                  {c.status === 'operational'
                    ? 'Operativo'
                    : c.status === 'degraded'
                    ? 'Degradado'
                    : c.status === 'outage'
                    ? 'Caído'
                    : 'Verificando...'}
                </p>
                {c.latencyMs && <p className="text-xs text-slate-400 mt-0.5">{c.latencyMs}ms</p>}
              </div>
            </div>
          ))}
        </div>

        <footer className="mt-8 text-xs text-slate-400 text-center">
          <p>Compromiso de uptime: <strong>99.9%</strong> Business · 99.95% Enterprise</p>
          <p className="mt-1">Para detalles, consulta el SLA. Para soporte: support@kaivor.co</p>
        </footer>
      </div>
    </main>
  );
}
