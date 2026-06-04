'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

const PROVIDER_INFO: Record<string, { name: string; icon: string; desc: string; needsKeys: boolean; needsReceiver: boolean }> = {
  nequi: { name: 'Nequi', icon: '📱', desc: 'Recibe pagos por Nequi.', needsKeys: false, needsReceiver: true },
  daviplata: { name: 'Daviplata', icon: '📲', desc: 'Recibe pagos por Daviplata.', needsKeys: false, needsReceiver: true },
  cards: { name: 'Tarjetas', icon: '💳', desc: 'Pagos con tarjeta débito y crédito.', needsKeys: true, needsReceiver: false },
  qr: { name: 'Pago QR', icon: '▦', desc: 'Cobra mostrando un código QR.', needsKeys: false, needsReceiver: true },
  addi: { name: 'Addi', icon: '🔁', desc: 'Crédito digital para tus clientes.', needsKeys: true, needsReceiver: false },
  bank_transfer: { name: 'Transferencia', icon: '🏦', desc: 'Transferencias bancarias.', needsKeys: false, needsReceiver: true },
  other: { name: 'Otro proveedor', icon: '➕', desc: 'Otra pasarela o método.', needsKeys: false, needsReceiver: false },
};

export default function PaymentIntegrationsPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [toast, setToast] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    axios.get(`${API}/settings/payment-integrations`, { headers })
      .then(r => setProviders(r.data.providers))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (!token) { router.push('/auth/login'); return; } load(); }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4000); };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      provider: p.provider, status: p.status, environment: p.environment || 'sandbox',
      merchantId: p.merchantId || '', receiverInfo: p.receiverInfo || '',
      apiBaseUrl: p.apiBaseUrl || '', publicKey: '', privateKey: '',
    });
  };

  const save = async () => {
    try {
      await axios.patch(`${API}/settings/payment-integrations`, form, { headers });
      showToast('Integración guardada');
      setEditing(null);
      load();
    } catch { showToast('No se pudo guardar'); }
  };

  const test = async (provider: string) => {
    setTesting(true);
    try {
      const res = await axios.post(`${API}/settings/payment-integrations`, { provider }, { headers });
      showToast(res.data.message);
      load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'No se pudo probar la conexión');
    } finally { setTesting(false); }
  };

  const openLogs = async (provider: string) => {
    setLogsFor(provider);
    setLogs([]);
    try {
      const res = await axios.get(`${API}/settings/payment-integrations?logs=${provider}`, { headers });
      setLogs(res.data.logs || []);
    } catch { /* noop */ }
  };

  if (loading) return (
    <AppLayout><div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-default border-t-brand rounded-full animate-spin" />
    </div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {toast && <div className="fixed top-4 right-4 z-50 bg-ink-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">{toast}</div>}

        <div className="mb-6">
          <button onClick={() => router.push('/settings/integrations')}
            className="text-sm text-soft hover:text-default mb-2 inline-flex items-center gap-1">
            ← Integraciones
          </button>
          <h1 className="text-2xl font-bold text-default">Integraciones de pago</h1>
          <p className="text-sm text-soft mt-0.5">Configura los medios de pago que aceptas en tus facturas.</p>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 mb-4">
          <p className="text-xs text-blue-700">
            Sin proveedor configurado, los pagos se registran de forma operativa (manual). Configura un proveedor para validar credenciales y dejar listo el adaptador real.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {providers.map(p => {
            const info = PROVIDER_INFO[p.provider] ?? PROVIDER_INFO.other;
            return (
              <div key={p.provider} className="surface rounded-xl border p-4 flex flex-col">
                <div className="flex items-start justify-between mb-1">
                  <span className="text-2xl">{info.icon}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.status === 'active' ? 'bg-emerald-100 text-emerald-700'
                    : p.status === 'error' ? 'bg-red-100 text-red-700' : 'surface-2 text-soft'}`}>
                    {p.status === 'active' ? 'Activo' : p.status === 'error' ? 'Error' : 'No configurado'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-default">{info.name}</p>
                <p className="text-xs text-soft mt-0.5 flex-1">{info.desc}</p>
                {p.lastTestAt && (
                  <p className="text-[11px] text-soft mt-1.5">
                    Última prueba: {new Date(p.lastTestAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' } as any)}
                  </p>
                )}
                {p.lastError && (
                  <p className="text-[11px] text-red-500 mt-0.5">Último error: {p.lastError}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={() => openEdit(p)}
                    className="text-xs bg-ink-900 text-white px-3 py-1.5 rounded-lg hover:bg-ink-700">Configurar</button>
                  {p.status === 'active' && (
                    <button onClick={() => test(p.provider)} disabled={testing}
                      className="text-xs surface-2 text-default px-3 py-1.5 rounded-lg hover:bg-brand-50 disabled:opacity-50">
                      Probar conexión
                    </button>
                  )}
                  <button onClick={() => openLogs(p.provider)}
                    className="text-xs surface-2 text-default px-3 py-1.5 rounded-lg hover:bg-brand-50">
                    Ver logs
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Config modal */}
        {editing && (() => {
          const info = PROVIDER_INFO[editing.provider] ?? PROVIDER_INFO.other;
          return (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
              <div className="surface rounded-xl p-5 max-w-md w-full max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h3 className="text-sm font-semibold text-default mb-3">{info.icon} {info.name}</h3>

                <label className="text-xs text-soft block mb-1">Estado</label>
                <div className="flex gap-2 mb-3">
                  {(['inactive', 'active'] as const).map(st => (
                    <button key={st} onClick={() => setForm((f: any) => ({ ...f, status: st }))}
                      className={`flex-1 py-1.5 text-xs rounded-lg border ${form.status === st ? 'border-ink-900 bg-ink-900 text-white' : 'border-default text-soft'}`}>
                      {st === 'active' ? 'Activo' : 'Inactivo'}
                    </button>
                  ))}
                </div>

                <label className="text-xs text-soft block mb-1">Ambiente</label>
                <div className="flex gap-2 mb-3">
                  {(['sandbox', 'production'] as const).map(env => (
                    <button key={env} onClick={() => setForm((f: any) => ({ ...f, environment: env }))}
                      className={`flex-1 py-1.5 text-xs rounded-lg border ${form.environment === env ? 'border-brand bg-brand-50 text-brand' : 'border-default text-soft'}`}>
                      {env === 'sandbox' ? 'Pruebas (sandbox)' : 'Producción'}
                    </button>
                  ))}
                </div>

                {info.needsReceiver && (
                  <>
                    <label className="text-xs text-soft block mb-1">Número / cuenta receptora</label>
                    <input type="text" value={form.receiverInfo} onChange={e => setForm((f: any) => ({ ...f, receiverInfo: e.target.value }))}
                      placeholder="Ej: 3001234567" className="w-full surface border rounded-lg px-3 py-2 text-sm mb-3 text-default" />
                  </>
                )}
                {info.needsKeys && (
                  <>
                    <label className="text-xs text-soft block mb-1">Merchant ID</label>
                    <input type="text" value={form.merchantId} onChange={e => setForm((f: any) => ({ ...f, merchantId: e.target.value }))}
                      className="w-full surface border rounded-lg px-3 py-2 text-sm mb-3 text-default" />
                    <label className="text-xs text-soft block mb-1">Llave pública {editing.hasKeys && <span className="text-emerald-600">(guardada)</span>}</label>
                    <input type="text" value={form.publicKey} onChange={e => setForm((f: any) => ({ ...f, publicKey: e.target.value }))}
                      placeholder={editing.hasKeys ? 'Dejar vacío para conservar' : 'pk_...'} className="w-full surface border rounded-lg px-3 py-2 text-sm mb-3 text-default" />
                    <label className="text-xs text-soft block mb-1">Llave privada</label>
                    <input type="password" value={form.privateKey} onChange={e => setForm((f: any) => ({ ...f, privateKey: e.target.value }))}
                      placeholder={editing.hasKeys ? 'Dejar vacío para conservar' : 'sk_...'} className="w-full surface border rounded-lg px-3 py-2 text-sm mb-3 text-default" />
                    <p className="text-xs text-soft mb-3">Las llaves se guardan cifradas (AES-256-GCM). Nunca se devuelven al navegador.</p>
                  </>
                )}

                <div className="flex gap-2">
                  <button onClick={save} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">Guardar</button>
                  <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-sm border border-default text-soft">Cancelar</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Logs modal */}
        {logsFor && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setLogsFor(null)}>
            <div className="surface rounded-xl p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-default mb-3">Logs — {logsFor}</h3>
              {logs.length === 0 ? (
                <p className="text-sm text-soft py-6 text-center">Sin registros para este proveedor.</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((l: any) => (
                    <div key={l.id} className="border border-default rounded-lg p-2.5 surface-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-default capitalize">{l.action}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          l.status === 'ok' ? 'bg-emerald-100 text-emerald-700'
                          : l.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {l.status}
                        </span>
                      </div>
                      {l.message && <p className="text-xs text-soft mt-1">{l.message}</p>}
                      <p className="text-[10px] text-soft mt-1">
                        {new Date(l.createdAt).toLocaleString('es-CO')}{l.environment ? ` · ${l.environment}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setLogsFor(null)}
                className="mt-4 w-full border border-default text-soft py-2 rounded-lg text-sm hover:bg-brand-50">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
