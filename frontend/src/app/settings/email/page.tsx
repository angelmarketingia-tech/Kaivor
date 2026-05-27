'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

interface TenantSettings {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpSecure: boolean;
  emailFromName: string | null;
  emailFromAddr: string | null;
  emailConfigured: boolean;
  hasSmtpPass: boolean;
}

const PRESETS = [
  { name: 'Gmail', host: 'smtp.gmail.com', port: 465, secure: true, hint: 'Usa una "Contraseña de aplicación" de Google, no tu contraseña normal.' },
  { name: 'Outlook', host: 'smtp-mail.outlook.com', port: 587, secure: false, hint: 'Funciona con tu contraseña de Outlook/Hotmail.' },
  { name: 'Zoho', host: 'smtp.zoho.com', port: 465, secure: true, hint: 'Requiere una contraseña de aplicación de Zoho.' },
];

export default function EmailSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [hint, setHint] = useState('');

  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [secure, setSecure] = useState(true);
  const [fromName, setFromName] = useState('');
  const [fromAddr, setFromAddr] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    axios.get(`${API}/settings/tenant`, { headers })
      .then(r => {
        const s: TenantSettings = r.data;
        setSettings(s);
        setHost(s.smtpHost || '');
        setPort(String(s.smtpPort || 587));
        setUser(s.smtpUser || '');
        setSecure(s.smtpSecure);
        setFromName(s.emailFromName || '');
        setFromAddr(s.emailFromAddr || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  const applyPreset = (p: typeof PRESETS[0]) => {
    setHost(p.host); setPort(String(p.port)); setSecure(p.secure); setHint(p.hint);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = {
        smtpHost: host, smtpPort: Number(port), smtpUser: user,
        smtpSecure: secure, emailFromName: fromName, emailFromAddr: fromAddr || user,
      };
      if (pass) payload.smtpPass = pass;
      const res = await axios.patch(`${API}/settings/tenant`, payload, { headers });
      setSettings(res.data);
      setPass('');
      showToast('Configuración de correo guardada.', 'ok');
    } catch { showToast('No pudimos guardar la configuración.', 'err'); }
    finally { setSaving(false); }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await axios.post(`${API}/settings/email/test`, { to: fromAddr || user }, { headers });
      showToast(`Correo de prueba enviado a ${res.data.sentTo}. Revisa tu bandeja.`, 'ok');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'No pudimos enviar el correo de prueba.', 'err');
    } finally { setTesting(false); }
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
          <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg max-w-sm ${toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.msg}
          </div>
        )}

        <div className="mb-5">
          <button onClick={() => router.push('/settings/integrations')}
            className="text-sm text-slate-500 hover:text-slate-900 mb-2 inline-flex items-center gap-1">
            ← Integraciones
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Correo / SMTP</h1>
          <p className="text-sm text-slate-500 mt-0.5">Configura tu correo para enviar facturas y recordatorios desde Kaivor.</p>
        </div>

        {/* Status */}
        <div className={`rounded-xl border p-4 mb-4 flex items-center gap-3 ${settings?.emailConfigured ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <span className="text-xl">{settings?.emailConfigured ? '✅' : '⚠️'}</span>
          <div>
            <p className={`text-sm font-semibold ${settings?.emailConfigured ? 'text-emerald-800' : 'text-amber-800'}`}>
              {settings?.emailConfigured ? 'Correo configurado' : 'Correo no configurado'}
            </p>
            <p className={`text-xs ${settings?.emailConfigured ? 'text-emerald-600' : 'text-amber-600'}`}>
              {settings?.emailConfigured ? 'Ya puedes enviar facturas por email.' : 'Completa los datos SMTP para activar el envío de emails.'}
            </p>
          </div>
        </div>

        {/* Presets */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Configuración rápida</p>
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map(p => (
              <button key={p.name} onClick={() => applyPreset(p)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors">
                {p.name}
              </button>
            ))}
          </div>
          {hint && <p className="text-xs text-violet-600 mt-2">{hint}</p>}
        </div>

        {/* SMTP form */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Servidor SMTP</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-500 block mb-1">Host SMTP</label>
              <input type="text" value={host} onChange={e => setHost(e.target.value)}
                placeholder="smtp.gmail.com"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Puerto</label>
              <input type="number" value={port} onChange={e => setPort(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Usuario / email</label>
            <input type="email" value={user} onChange={e => setUser(e.target.value)}
              placeholder="tu@empresa.com"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">
              Contraseña {settings?.hasSmtpPass && <span className="text-emerald-600">(guardada · déjala vacía para mantenerla)</span>}
            </label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)}
              placeholder={settings?.hasSmtpPass ? '••••••••' : 'Contraseña o app password'}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={secure} onChange={e => setSecure(e.target.checked)}
              className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
            <span className="text-sm text-slate-700">Conexión segura SSL/TLS (recomendado para puerto 465)</span>
          </label>
        </div>

        {/* Sender */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 mt-4">
          <h2 className="text-sm font-semibold text-slate-700">Remitente</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Nombre del remitente</label>
              <input type="text" value={fromName} onChange={e => setFromName(e.target.value)}
                placeholder="Mi Empresa S.A.S."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Email del remitente</label>
              <input type="email" value={fromAddr} onChange={e => setFromAddr(e.target.value)}
                placeholder="(usa el usuario SMTP)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button onClick={save} disabled={saving}
            className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar configuración'}
          </button>
          <button onClick={testConnection} disabled={testing || !settings?.emailConfigured}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40">
            {testing ? 'Enviando…' : 'Probar conexión'}
          </button>
        </div>
        {!settings?.emailConfigured && (
          <p className="text-xs text-slate-400 mt-2 text-center">Guarda la configuración antes de probar la conexión.</p>
        )}
      </div>
    </AppLayout>
  );
}
