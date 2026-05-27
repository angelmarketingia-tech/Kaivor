'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Template {
  id: string;
  channel: string;
  name: string;
  subject: string | null;
  body: string;
  active: boolean;
}

const WA_MODES = [
  { id: 'manual', label: 'Manual (wa.me)', desc: 'Abre WhatsApp con el mensaje prellenado. Sin costo, listo para usar.' },
  { id: 'business_api', label: 'WhatsApp Business API', desc: 'Requiere cuenta de WhatsApp Business API.' },
  { id: 'meta_cloud', label: 'Meta Cloud API', desc: 'API oficial de Meta para WhatsApp.' },
  { id: 'twilio', label: 'Twilio', desc: 'Envío vía Twilio WhatsApp.' },
  { id: 'dialog360', label: '360dialog', desc: 'Proveedor 360dialog.' },
];

const VARS = ['{cliente}', '{numeroFactura}', '{total}', '{linkFactura}', '{empresa}'];

export default function WhatsAppSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const [waMode, setWaMode] = useState('manual');
  const [countryCode, setCountryCode] = useState('57');
  const [businessPhone, setBusinessPhone] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);
  const [testPhone, setTestPhone] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    Promise.allSettled([
      axios.get(`${API}/settings/tenant`, { headers }),
      axios.get(`${API}/messages/templates`, { headers }),
    ]).then(([sRes, tRes]) => {
      if (sRes.status === 'fulfilled') {
        setWaMode(sRes.value.data.waMode || 'manual');
        setCountryCode(sRes.value.data.waCountryCode || '57');
        setBusinessPhone(sRes.value.data.waBusinessPhone || '');
      }
      if (tRes.status === 'fulfilled') setTemplates(tRes.value.data.filter((t: Template) => t.channel === 'whatsapp'));
    }).finally(() => setLoading(false));
  }, []);

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API}/settings/tenant`, {
        waMode, waCountryCode: countryCode, waBusinessPhone: businessPhone,
      }, { headers });
      showToast('Configuración de WhatsApp guardada.', 'ok');
    } catch { showToast('No pudimos guardar la configuración.', 'err'); }
    finally { setSaving(false); }
  };

  const saveTemplate = async () => {
    if (!editing) return;
    try {
      if (editing.id) {
        const res = await axios.patch(`${API}/messages/templates/${editing.id}`,
          { name: editing.name, body: editing.body }, { headers });
        setTemplates(ts => ts.map(t => t.id === editing.id ? res.data : t));
      } else {
        const res = await axios.post(`${API}/messages/templates`,
          { channel: 'whatsapp', name: editing.name, body: editing.body }, { headers });
        setTemplates(ts => [...ts, res.data]);
      }
      setEditing(null);
      showToast('Plantilla guardada.', 'ok');
    } catch { showToast('No pudimos guardar la plantilla.', 'err'); }
  };

  const deleteTemplate = async (id: string) => {
    try {
      await axios.delete(`${API}/messages/templates/${id}`, { headers });
      setTemplates(ts => ts.filter(t => t.id !== id));
      showToast('Plantilla eliminada.', 'ok');
    } catch { showToast('No pudimos eliminar la plantilla.', 'err'); }
  };

  const testSend = (tpl: Template) => {
    const phone = testPhone.replace(/\D/g, '');
    if (!phone) { showToast('Ingresa un número de prueba.', 'err'); return; }
    const formatted = phone.startsWith(countryCode) ? phone : `${countryCode}${phone}`;
    const msg = tpl.body
      .replace(/{cliente}/g, 'Cliente de prueba')
      .replace(/{numeroFactura}/g, 'FAC-2026-000001')
      .replace(/{total}/g, '$150.000')
      .replace(/{linkFactura}/g, 'https://kaivor.vercel.app')
      .replace(/{empresa}/g, 'Mi Empresa');
    window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`, '_blank');
    axios.post(`${API}/messages`, {
      channel: 'whatsapp', destination: formatted, message: msg,
    }, { headers }).catch(() => {});
  };

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.msg}
          </div>
        )}

        <div className="mb-5">
          <button onClick={() => router.push('/settings/integrations')}
            className="text-sm text-slate-500 hover:text-slate-900 mb-2 inline-flex items-center gap-1">
            ← Integraciones
          </button>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp</h1>
          <p className="text-sm text-slate-500 mt-0.5">Envía facturas y recordatorios a tus clientes por WhatsApp.</p>
        </div>

        {/* Mode */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Modo de envío</h2>
          <div className="space-y-2">
            {WA_MODES.map(m => (
              <button key={m.id} onClick={() => setWaMode(m.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${waMode === m.id ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900">{m.label}</p>
                  {m.id === 'manual' && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Recomendado</span>}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>
          {waMode !== 'manual' && (
            <p className="text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Este modo requiere credenciales del proveedor. Por ahora, el envío usará wa.me como respaldo funcional.
            </p>
          )}
        </div>

        {/* Phone config */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Número de la empresa</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Código país</label>
              <input type="text" value={countryCode} onChange={e => setCountryCode(e.target.value.replace(/\D/g, ''))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 block mb-1">Número de WhatsApp</label>
              <input type="text" value={businessPhone} onChange={e => setBusinessPhone(e.target.value)}
                placeholder="3001234567"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <button onClick={saveConfig} disabled={saving}
            className="mt-3 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>

        {/* Templates */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Plantillas de mensaje</h2>
            <button onClick={() => setEditing({ id: '', channel: 'whatsapp', name: '', subject: null, body: '', active: true })}
              className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700">
              + Nueva plantilla
            </button>
          </div>

          {/* Test phone */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-slate-500">Probar con:</span>
            <input type="text" value={testPhone} onChange={e => setTestPhone(e.target.value)}
              placeholder="número de prueba"
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs flex-1" />
          </div>

          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-slate-900">{t.name}</p>
                  <div className="flex gap-1.5">
                    <button onClick={() => testSend(t)} className="text-xs text-green-600 hover:underline">Probar</button>
                    <button onClick={() => setEditing(t)} className="text-xs text-violet-600 hover:underline">Editar</button>
                    <button onClick={() => deleteTemplate(t.id)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{t.body}</p>
              </div>
            ))}
            {templates.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Sin plantillas aún.</p>}
          </div>
        </div>

        {/* Editor modal */}
        {editing && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
            <div className="bg-white rounded-xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">{editing.id ? 'Editar plantilla' : 'Nueva plantilla'}</h3>
              <label className="text-xs text-slate-500 block mb-1">Nombre</label>
              <input type="text" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3" />
              <label className="text-xs text-slate-500 block mb-1">Mensaje</label>
              <textarea rows={4} value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none mb-2" />
              <div className="flex flex-wrap gap-1 mb-3">
                {VARS.map(v => (
                  <button key={v} onClick={() => setEditing({ ...editing, body: editing.body + ' ' + v })}
                    className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded hover:bg-slate-200 font-mono">{v}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={saveTemplate} disabled={!editing.name || !editing.body}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40">
                  Guardar
                </button>
                <button onClick={() => setEditing(null)}
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
