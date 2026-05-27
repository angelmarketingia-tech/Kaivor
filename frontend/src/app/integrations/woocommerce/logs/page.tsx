'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Log {
  id: string;
  level: string;
  event: string;
  message: string;
  createdAt: string;
}

const levelBadge: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
  critical: 'bg-red-200 text-red-900',
};

function LogsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const integrationId = searchParams.get('id');

  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!integrationId) { setError('No se especificó integración.'); setLoading(false); return; }
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }

    axios
      .get(`${API}/integrations/${integrationId}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setLogs(res.data))
      .catch((err) => setError(err.response?.data?.message ?? 'Error cargando logs.'))
      .finally(() => setLoading(false));
  }, [integrationId, router]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />)}
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-700">{error}</div>
      )}
      {logs.length === 0 && !error ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No hay logs registrados aún.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Nivel</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">Evento</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Mensaje</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${levelBadge[log.level] ?? 'bg-slate-100 text-slate-600'}`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-xs hidden sm:table-cell">{log.event}</td>
                  <td className="px-5 py-3 text-slate-800 text-xs">{log.message}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap hidden md:table-cell">
                    {new Date(log.createdAt).toLocaleString('es-CO')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function WooCommerceLogsPage() {
  const router = useRouter();

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/integrations/woocommerce')}
            className="text-sm text-slate-500 hover:text-slate-900 mb-3 inline-flex items-center gap-1"
          >
            ← WooCommerce
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Logs de sincronización</h1>
          <p className="text-sm text-slate-500 mt-0.5">Historial de sincronizaciones y webhooks.</p>
        </div>

        <Suspense fallback={
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />)}
          </div>
        }>
          <LogsContent />
        </Suspense>
      </div>
    </AppLayout>
  );
}
