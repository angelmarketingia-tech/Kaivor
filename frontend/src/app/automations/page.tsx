'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmtDate = (d: string) => new Date(d).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' } as any);

const TRIGGERS: Record<string, string> = {
  invoice_overdue: 'Cuando una factura vence',
  low_stock: 'Cuando un producto tiene stock bajo',
  customer_inactive: 'Cuando un cliente no compra hace 30 días',
  product_expiring: 'Cuando un producto está próximo a vencer',
  onboarding_incomplete: 'Cuando falta completar la configuración',
  invoice_created: 'Cuando se crea una factura',
};
const ACTIONS: Record<string, string> = {
  create_crm_activity: 'Registrar actividad en CRM',
  send_whatsapp_reminder: 'Sugerir recordatorio por WhatsApp',
  send_email_reminder: 'Sugerir recordatorio por email',
  create_alert: 'Crear alerta',
  notify_admin: 'Notificar al administrador',
  suggest_promotion: 'Sugerir promoción',
};

const SUGGESTED = [
  { name: 'Cobro de facturas vencidas', description: 'Detecta facturas vencidas y registra actividad de cobro en el CRM.', trigger: 'invoice_overdue', actions: ['create_crm_activity', 'send_whatsapp_reminder'] },
  { name: 'Alerta de stock bajo', description: 'Avisa cuando un producto necesita reposición.', trigger: 'low_stock', actions: ['create_alert', 'notify_admin'] },
  { name: 'Recuperar clientes inactivos', description: 'Detecta clientes sin compras y registra seguimiento en el CRM.', trigger: 'customer_inactive', actions: ['create_crm_activity', 'send_whatsapp_reminder'] },
  { name: 'Recordar completar configuración', description: 'Avisa si falta logo, datos fiscales, WhatsApp o correo.', trigger: 'onboarding_incomplete', actions: ['notify_admin'] },
];

interface Run { id: string; status: string; summary: string | null; error?: string | null; executedAt: string }
interface Automation {
  id: string; name: string; description: string | null; trigger: string;
  actions: string[]; status: string; runCount: number; lastRunAt: string | null;
  runs: Run[];
}

export default function AutomationsPage() {
  const router = useRouter();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [runResult, setRunResult] = useState<{ id: string; text: string } | null>(null);

  // builder
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('invoice_overdue');
  const [actions, setActions] = useState<string[]>(['create_crm_activity']);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    axios.get(`${API}/automations`, { headers }).then(r => setAutomations(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    load();
  }, []);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const create = async (payload: { name: string; description?: string; trigger: string; actions: string[] }) => {
    try {
      await axios.post(`${API}/automations`, payload, { headers });
      showToast('Automatización creada.');
      setCreating(false); setName(''); setActions(['create_crm_activity']);
      load();
    } catch (err: any) { showToast(err.response?.data?.message || 'No pudimos crear la automatización.', 'err'); }
  };

  const toggleStatus = async (a: Automation) => {
    try {
      await axios.patch(`${API}/automations/${a.id}`, { status: a.status === 'active' ? 'paused' : 'active' }, { headers });
      load();
    } catch { showToast('No pudimos actualizar.', 'err'); }
  };

  const run = async (a: Automation) => {
    try {
      const res = await axios.post(`${API}/automations/${a.id}/run`, {}, { headers });
      setRunResult({ id: a.id, text: res.data.summary });
      load();
    } catch { showToast('No pudimos ejecutar la automatización.', 'err'); }
  };

  const del = async (id: string) => {
    try { await axios.delete(`${API}/automations/${id}`, { headers }); load(); showToast('Automatización eliminada.'); }
    catch { showToast('No pudimos eliminar.', 'err'); }
  };

  const usedTriggers = new Set(automations.map(a => a.name));

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.msg}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-default">Automatizaciones</h1>
            <p className="text-sm text-soft mt-0.5">Automatiza procesos repetitivos de tu negocio.</p>
          </div>
          <button onClick={() => setCreating(true)}
            className="bg-brand text-ink-900 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-brand-300">
            + Crear
          </button>
        </div>

        {/* Active automations */}
        {loading ? (
          <div className="space-y-2 mb-6">
            {[...Array(2)].map((_, i) => <div key={i} className="h-20 surface-2 animate-pulse rounded-xl" />)}
          </div>
        ) : automations.length > 0 ? (
          <div className="space-y-3 mb-6">
            {automations.map(a => (
              <div key={a.id} className="surface rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-default">{a.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'surface-2 text-soft'}`}>
                        {a.status === 'active' ? 'Activa' : 'Pausada'}
                      </span>
                    </div>
                    <p className="text-xs text-soft mt-0.5">{TRIGGERS[a.trigger]}</p>
                    <p className="text-xs text-soft mt-0.5">
                      {a.actions.map(ac => ACTIONS[ac]).filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs text-soft mt-1">
                      {a.runCount} ejecución(es){a.lastRunAt ? ` · última ${fmtDate(a.lastRunAt)}` : ''}
                    </p>
                  </div>
                </div>
                {runResult?.id === a.id && (
                  <div className="border rounded-lg px-3 py-2 mt-2" style={{ backgroundColor: 'rgba(163,204,57,0.10)', borderColor: 'rgba(163,204,57,0.22)' }}>
                    <p className="text-xs text-brand">{runResult.text}</p>
                  </div>
                )}
                {a.runs && a.runs.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-soft font-medium">Historial de ejecuciones</p>
                    {a.runs.slice(0, 4).map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-xs">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          r.status === 'success' ? 'bg-emerald-500' : r.status === 'failed' ? 'bg-red-500' : 'bg-slate-300'}`} />
                        <span className="text-soft">{fmtDate(r.executedAt)}</span>
                        <span className={`truncate ${r.status === 'failed' ? 'text-red-600' : 'text-soft'}`}>
                          {r.status === 'failed' ? `Error: ${r.error || 'falló'}` : r.summary}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-3 pt-3 border-t border-default">
                  <button onClick={() => run(a)} className="text-xs bg-brand text-ink-900 font-semibold px-3 py-1.5 rounded-lg hover:bg-brand-300">Probar ahora</button>
                  <button onClick={() => toggleStatus(a)} className="text-xs surface-2 text-default px-3 py-1.5 rounded-lg hover:opacity-80">
                    {a.status === 'active' ? 'Pausar' : 'Activar'}
                  </button>
                  <button onClick={() => del(a.id)} className="text-xs text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="surface rounded-xl border p-8 text-center mb-6">
            <p className="text-3xl mb-2">⚡</p>
            <p className="text-sm font-medium text-default">Sin automatizaciones aún</p>
            <p className="text-xs text-soft mt-0.5">Empieza con una de las plantillas sugeridas abajo.</p>
          </div>
        )}

        {/* Suggested */}
        <h2 className="text-sm font-semibold text-default mb-2">Automatizaciones sugeridas</h2>
        <div className="space-y-2">
          {SUGGESTED.map(s => (
            <div key={s.name} className="surface rounded-xl border p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-default">{s.name}</p>
                <p className="text-xs text-soft">{s.description}</p>
              </div>
              <button onClick={() => create(s)} disabled={usedTriggers.has(s.name)}
                className="text-xs bg-ink-900 text-white px-3 py-1.5 rounded-lg hover:bg-ink-700 disabled:opacity-40 flex-shrink-0">
                {usedTriggers.has(s.name) ? 'Creada' : 'Activar'}
              </button>
            </div>
          ))}
        </div>

        <p className="text-xs text-soft mt-4 surface-2 border border-default rounded-lg px-3 py-2">
          Las automatizaciones se ejecutan al pulsar "Probar ahora" y detectan los casos que cumplen la condición.
          La ejecución programada automática estará disponible próximamente.
        </p>

        {/* Builder modal */}
        {creating && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setCreating(false)}>
            <div className="surface rounded-xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-default mb-3">Nueva automatización</h3>
              <label className="text-xs text-soft block mb-1">Nombre</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Ej: Recordatorio de cobro"
                className="w-full surface border rounded-lg px-3 py-2 text-sm text-default mb-3" />

              <label className="text-xs text-soft block mb-1">CUANDO… (disparador)</label>
              <select value={trigger} onChange={e => setTrigger(e.target.value)}
                className="w-full surface border rounded-lg px-3 py-2 text-sm text-default mb-3">
                {Object.entries(TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>

              <label className="text-xs text-soft block mb-1">ENTONCES… (acciones)</label>
              <div className="space-y-1.5 mb-4">
                {Object.entries(ACTIONS).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={actions.includes(k)}
                      onChange={e => setActions(a => e.target.checked ? [...a, k] : a.filter(x => x !== k))}
                      className="rounded border-default text-brand focus:ring-brand" />
                    <span className="text-sm text-default">{v}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={() => create({ name, trigger, actions })}
                  disabled={!name.trim() || actions.length === 0}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40">
                  Crear automatización
                </button>
                <button onClick={() => setCreating(false)}
                  className="px-4 py-2 rounded-lg text-sm border border-default text-soft hover:opacity-80">
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
