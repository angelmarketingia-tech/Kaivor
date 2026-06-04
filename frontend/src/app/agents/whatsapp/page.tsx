'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

type Config = {
  enabled: boolean;
  agentName: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  monthlyMessageLimit: number;
  monthlyMessageCount: number;
  metaPhoneNumberId: string | null;
  metaWabaId: string | null;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  metaWebhookVerifyToken: string | null;
  tenantId?: string;
  webhookCallbackUrl?: string;
};

type Conversation = {
  id: string;
  phoneNumber: string;
  customerId: string | null;
  status: string;
  unreadCount: number;
  lastMessageAt: string;
  messages: { content: string; role: string; createdAt: string }[];
};

type Message = {
  id: string;
  role: 'user' | 'agent' | 'human' | 'system';
  content: string;
  status: string;
  createdAt: string;
  toolCalls?: any;
};

export default function WhatsappAgentPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'playground' | 'conversations' | 'config'>('playground');
  const [config, setConfig] = useState<Config | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [convDetail, setConvDetail] = useState<{ messages: Message[]; status: string; phoneNumber: string } | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const tenantId = typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('user') || '{}')?.tenantId || '') : '';
  const webhookUrl = `${API}/webhooks/whatsapp/${tenantId}`;

  const loadConfig = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/agents/whatsapp/config`, { headers });
      setConfig(r.data);
    } catch (e: any) {
      if (e?.response?.status === 401) router.push('/auth/login');
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/agents/whatsapp/conversations`, { headers });
      setConversations(r.data);
    } catch {}
  }, []);

  const loadConversation = async (id: string) => {
    try {
      const r = await axios.get(`${API}/agents/whatsapp/conversations/${id}`, { headers });
      setConvDetail({ messages: r.data.messages || [], status: r.data.status, phoneNumber: r.data.phoneNumber });
    } catch {}
  };

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    loadConfig();
    loadConversations();
    const interval = setInterval(() => {
      loadConversations();
      if (selected) loadConversation(selected);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selected) loadConversation(selected);
  }, [selected]);

  const saveConfig = async (patch: Partial<Config> & { metaAccessToken?: string; metaAppSecret?: string }) => {
    setSavingCfg(true);
    try {
      await axios.patch(`${API}/agents/whatsapp/config`, patch, { headers });
      await loadConfig();
      setToast('Configuración guardada');
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast('Error al guardar');
      setTimeout(() => setToast(null), 2500);
    } finally { setSavingCfg(false); }
  };

  const takeOver = async (id: string) => {
    await axios.post(`${API}/agents/whatsapp/conversations/${id}/takeover`, {}, { headers });
    loadConversation(id);
  };
  const release = async (id: string) => {
    await axios.post(`${API}/agents/whatsapp/conversations/${id}/release`, {}, { headers });
    loadConversation(id);
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      await axios.post(`${API}/agents/whatsapp/conversations/${selected}/send`, { content: reply }, { headers });
      setReply('');
      loadConversation(selected);
    } catch {} finally { setSending(false); }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-ink-900 text-white px-4 py-2 rounded-lg text-sm shadow-lg">{toast}</div>
        )}

        <div className="mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-default">Agente WhatsApp</h1>
              <p className="text-sm text-soft mt-0.5">
                Asistente automático que responde por WhatsApp usando tu catálogo y datos.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-soft">Mensajes este mes</p>
              <p className="text-lg font-semibold text-default">
                {config ? `${config.monthlyMessageCount} / ${config.monthlyMessageLimit}` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-default mb-4">
          {(['playground', 'conversations', 'config'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-soft hover:text-default'
              }`}
            >
              {t === 'playground' ? '🧪 Playground' : t === 'conversations' ? `Conversaciones (${conversations.length})` : 'Configuración'}
            </button>
          ))}
        </div>

        {tab === 'playground' && (
          <Playground apiUrl={API!} headers={headers} />
        )}

        {tab === 'config' && config && (
          <ConfigPanel
            config={config}
            webhookUrl={config.webhookCallbackUrl || webhookUrl}
            tenantId={config.tenantId || tenantId}
            apiUrl={API!}
            headers={headers}
            saving={savingCfg}
            onSave={saveConfig}
          />
        )}

        {tab === 'conversations' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
            {/* List */}
            <div className="surface rounded-xl border overflow-hidden md:col-span-1">
              <div className="px-4 py-3 border-b border-default text-sm font-semibold text-default">
                Recientes
              </div>
              <div className="overflow-y-auto h-full">
                {conversations.length === 0 ? (
                  <p className="text-sm text-soft text-center py-8 px-4">
                    Aún no hay conversaciones. Cuando un cliente escriba a tu WhatsApp Business, aparecerá aquí.
                  </p>
                ) : conversations.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    className={`w-full text-left px-4 py-3 border-b border-default hover:opacity-80 transition ${
                      selected === c.id ? 'bg-emerald-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm text-default">+{c.phoneNumber}</p>
                      {c.unreadCount > 0 && (
                        <span className="bg-emerald-600 text-white text-xs px-1.5 rounded-full">{c.unreadCount}</span>
                      )}
                    </div>
                    <p className="text-xs text-soft truncate mt-0.5">
                      {c.messages[0]?.content || '—'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        c.status === 'taken_over_by_human' ? 'bg-amber-100 text-amber-800' :
                        c.status === 'paused' ? 'surface-2 text-soft' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {c.status === 'taken_over_by_human' ? 'Humano' :
                         c.status === 'paused' ? 'Pausado' : 'Agente'}
                      </span>
                      <span className="text-[10px] text-soft">
                        {new Date(c.lastMessageAt).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit' } as any)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail */}
            <div className="surface rounded-xl border md:col-span-2 flex flex-col overflow-hidden">
              {!selected || !convDetail ? (
                <div className="flex-1 flex items-center justify-center text-sm text-soft">
                  Selecciona una conversación
                </div>
              ) : (
                <>
                  <div className="px-4 py-3 border-b border-default flex items-center justify-between">
                    <p className="font-medium text-sm text-default">+{convDetail.phoneNumber}</p>
                    <div className="flex gap-2">
                      {convDetail.status === 'taken_over_by_human' ? (
                        <button onClick={() => release(selected)} className="text-xs bg-emerald-600 text-white px-3 py-1 rounded">
                          Devolver al agente
                        </button>
                      ) : (
                        <button onClick={() => takeOver(selected)} className="text-xs bg-amber-500 text-white px-3 py-1 rounded">
                          Tomar el control
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 app-bg">
                    {convDetail.messages.map(m => (
                      <div
                        key={m.id}
                        className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                          m.role === 'user' ? 'surface text-default border' :
                          m.role === 'human' ? 'bg-amber-100 text-amber-900' :
                          'bg-emerald-100 text-emerald-900'
                        }`}>
                          <p className="whitespace-pre-wrap">{m.content}</p>
                          <p className="text-[10px] opacity-60 mt-1">
                            {m.role === 'user' ? '👤 Cliente' : m.role === 'human' ? '👨‍💼 Humano' : '🤖 Agente'} ·{' '}
                            {new Date(m.createdAt).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit' } as any)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {convDetail.status === 'taken_over_by_human' && (
                    <div className="p-3 border-t border-default flex gap-2">
                      <input
                        type="text"
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendReply()}
                        placeholder="Responder al cliente..."
                        className="flex-1 surface border rounded-lg px-3 py-2 text-sm text-default"
                      />
                      <button
                        onClick={sendReply}
                        disabled={sending || !reply.trim()}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40"
                      >
                        {sending ? '...' : 'Enviar'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function ConfigPanel({ config, webhookUrl, tenantId, apiUrl, headers, saving, onSave }: {
  config: Config; webhookUrl: string; tenantId: string;
  apiUrl: string; headers: Record<string, string>;
  saving: boolean;
  onSave: (patch: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    enabled: config.enabled,
    agentName: config.agentName,
    systemPrompt: config.systemPrompt,
    monthlyMessageLimit: config.monthlyMessageLimit,
    metaPhoneNumberId: config.metaPhoneNumberId || '',
    metaWabaId: config.metaWabaId || '',
    metaWebhookVerifyToken: config.metaWebhookVerifyToken || '',
    metaAccessToken: '',
    metaAppSecret: '',
  });
  const [copied, setCopied] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showGuide, setShowGuide] = useState(true);

  const copyText = (txt: string, key: string) => {
    navigator.clipboard.writeText(txt);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      const r = await axios.post(`${apiUrl}/agents/whatsapp/validate`, {}, { headers });
      setValidationResult(r.data);
    } catch (e: any) {
      setValidationResult({ ok: false, error: e?.response?.data?.error || 'Error de red' });
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Setup helper: tenantId + Webhook URL */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-emerald-900">📋 Datos para configurar en Meta</h3>

        <div>
          <label className="text-xs text-emerald-800 block mb-1 font-medium">
            URL de Webhook (pega esto en Meta → WhatsApp → Configuration → Webhook):
          </label>
          <div className="flex gap-2">
            <code className="flex-1 bg-white px-3 py-2 rounded border border-emerald-300 text-xs break-all">
              {webhookUrl}
            </code>
            <button onClick={() => copyText(webhookUrl, 'url')} className="bg-emerald-600 text-white px-3 py-2 rounded text-xs whitespace-nowrap">
              {copied === 'url' ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-emerald-800 block mb-1 font-medium">
            Tu Tenant ID (para soporte técnico):
          </label>
          <div className="flex gap-2">
            <code className="flex-1 bg-white px-3 py-2 rounded border border-emerald-300 text-xs break-all">
              {tenantId}
            </code>
            <button onClick={() => copyText(tenantId, 'tid')} className="bg-emerald-600 text-white px-3 py-2 rounded text-xs whitespace-nowrap">
              {copied === 'tid' ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>

      {/* General */}
      <div className="surface rounded-xl border p-5">
        <h3 className="text-sm font-semibold text-default mb-4">General</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={e => setForm({ ...form, enabled: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-default">Agente activo (responde automáticamente)</span>
          </label>

          <div>
            <label className="text-xs text-soft block mb-1">Nombre del agente</label>
            <input
              type="text"
              value={form.agentName}
              onChange={e => setForm({ ...form, agentName: e.target.value })}
              className="w-full surface border rounded-lg px-3 py-2 text-sm text-default"
            />
          </div>

          <div>
            <label className="text-xs text-soft block mb-1">
              Prompt del sistema (personaliza cómo se comporta el agente)
            </label>
            <textarea
              value={form.systemPrompt}
              onChange={e => setForm({ ...form, systemPrompt: e.target.value })}
              rows={6}
              className="w-full surface border rounded-lg px-3 py-2 text-sm text-default font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-soft block mb-1">Límite mensual de mensajes</label>
            <input
              type="number"
              value={form.monthlyMessageLimit}
              onChange={e => setForm({ ...form, monthlyMessageLimit: Number(e.target.value) })}
              className="w-full surface border rounded-lg px-3 py-2 text-sm text-default"
            />
          </div>
        </div>
      </div>

      {/* Meta Credentials */}
      <div className="surface rounded-xl border p-5">
        <h3 className="text-sm font-semibold text-default mb-1">Credenciales Meta WhatsApp Cloud API</h3>
        <p className="text-xs text-soft mb-4">
          Obtén estos valores en{' '}
          <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener" className="text-emerald-600 underline">
            Meta Developers Console
          </a>
          .
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-soft block mb-1">
              Phone Number ID <span className="text-soft">(ej: 102345678901234)</span>
            </label>
            <input
              type="text"
              value={form.metaPhoneNumberId}
              onChange={e => setForm({ ...form, metaPhoneNumberId: e.target.value })}
              className="w-full surface border rounded-lg px-3 py-2 text-sm text-default font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-soft block mb-1">
              WhatsApp Business Account ID (WABA)
            </label>
            <input
              type="text"
              value={form.metaWabaId}
              onChange={e => setForm({ ...form, metaWabaId: e.target.value })}
              className="w-full surface border rounded-lg px-3 py-2 text-sm text-default font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-soft block mb-1">
              Access Token {config.hasAccessToken && <span className="text-emerald-600">· (configurado)</span>}
            </label>
            <input
              type="password"
              placeholder={config.hasAccessToken ? '••• configurado · pega uno nuevo para cambiar' : 'EAA...'}
              value={form.metaAccessToken}
              onChange={e => setForm({ ...form, metaAccessToken: e.target.value })}
              className="w-full surface border rounded-lg px-3 py-2 text-sm text-default font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-soft block mb-1">
              Webhook Verify Token <span className="text-soft">(elige tú una contraseña aleatoria)</span>
            </label>
            <input
              type="text"
              value={form.metaWebhookVerifyToken}
              onChange={e => setForm({ ...form, metaWebhookVerifyToken: e.target.value })}
              placeholder="kaivor-secret-xyz-123"
              className="w-full surface border rounded-lg px-3 py-2 text-sm text-default font-mono"
            />
            <p className="text-xs text-soft mt-1">
              Lo necesitarás también en Meta Webhook Settings.
            </p>
          </div>
          <div>
            <label className="text-xs text-soft block mb-1">
              App Secret (opcional, para verificar firma HMAC){config.hasAppSecret && <span className="text-emerald-600"> · configurado</span>}
            </label>
            <input
              type="password"
              placeholder={config.hasAppSecret ? '••• configurado' : 'opcional'}
              value={form.metaAppSecret}
              onChange={e => setForm({ ...form, metaAppSecret: e.target.value })}
              className="w-full surface border rounded-lg px-3 py-2 text-sm text-default font-mono"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="bg-brand text-ink-900 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-300 disabled:opacity-40"
        >
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
        <button
          onClick={handleValidate}
          disabled={validating || !config.hasAccessToken || !config.metaPhoneNumberId}
          title={!config.hasAccessToken || !config.metaPhoneNumberId ? 'Primero guarda Access Token y Phone Number ID' : 'Hacer ping a Meta Graph API con las credenciales guardadas'}
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40"
        >
          {validating ? 'Validando...' : '🔌 Validar credenciales con Meta'}
        </button>
      </div>

      {validationResult && (
        <div className={`rounded-xl p-4 text-sm border ${validationResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {validationResult.ok ? (
            <>
              <p className="font-semibold mb-2">✅ Credenciales válidas. Meta confirmó:</p>
              <ul className="space-y-1 text-xs">
                <li>· <strong>Número:</strong> {validationResult.displayPhoneNumber || '(sin número)'}</li>
                <li>· <strong>Nombre verificado:</strong> {validationResult.verifiedName || '(sin nombre)'}</li>
                <li>· <strong>Quality rating:</strong> {validationResult.qualityRating || 'UNKNOWN'}</li>
              </ul>
            </>
          ) : (
            <>
              <p className="font-semibold mb-1">❌ Meta rechazó las credenciales</p>
              <p className="text-xs">{validationResult.error}</p>
              {validationResult.metaErrorCode && (
                <p className="text-xs mt-1 text-red-700">Código Meta: {validationResult.metaErrorCode} ({validationResult.metaErrorType})</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Guía paso a paso para conectar WhatsApp Cloud API */}
      <div className="surface rounded-xl border overflow-hidden">
        <button
          onClick={() => setShowGuide(g => !g)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:opacity-80"
        >
          <span className="text-sm font-semibold text-default">📘 Guía: cómo conectar tu WhatsApp (paso a paso)</span>
          <span className="text-soft text-lg">{showGuide ? '−' : '+'}</span>
        </button>
        {showGuide && (
          <div className="px-5 pb-5 text-sm text-soft space-y-4 border-t border-default pt-4">
            <p className="text-xs text-soft">
              Necesitas una cuenta de <strong>Meta Business</strong> y un número de WhatsApp dedicado (no tu WhatsApp personal). Todo el proceso toma ~30 minutos y se hace una sola vez.
            </p>

            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">1</span>
                <div>
                  <p className="font-medium text-default">Crea una app en Meta for Developers</p>
                  <p className="text-xs text-soft">Entra a <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener" className="text-emerald-600 underline">developers.facebook.com/apps</a> → “Crear app” → tipo “Negocio”. Dentro de la app, agrega el producto <strong>WhatsApp</strong>.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">2</span>
                <div>
                  <p className="font-medium text-default">Copia tus credenciales</p>
                  <p className="text-xs text-soft">En WhatsApp → “Configuración de la API”, copia el <strong>Phone Number ID</strong> y el <strong>WhatsApp Business Account ID (WABA)</strong>. Genera un <strong>Access Token</strong> permanente (System User token, no el temporal de 24h). Pégalos arriba ☝️.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">3</span>
                <div>
                  <p className="font-medium text-default">Elige tu Verify Token y guárdalo</p>
                  <p className="text-xs text-soft">Inventa una contraseña aleatoria en el campo “Webhook Verify Token” de arriba (ej: <code className="surface-2 px-1 rounded">kaivor-{tenantId.slice(0, 6)}</code>) y dale <strong>Guardar configuración</strong>. La necesitarás en el paso 4.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">4</span>
                <div>
                  <p className="font-medium text-default">Configura el Webhook en Meta</p>
                  <p className="text-xs text-soft">En WhatsApp → “Configuración” → Webhook → “Editar”. Pega:</p>
                  <ul className="text-xs text-soft mt-1 space-y-0.5">
                    <li>• <strong>Callback URL:</strong> <code className="surface-2 px-1 rounded break-all">{webhookUrl}</code></li>
                    <li>• <strong>Verify token:</strong> el mismo que pusiste en el paso 3</li>
                  </ul>
                  <p className="text-xs text-soft mt-1">Luego suscríbete al campo <strong>messages</strong>.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">5</span>
                <div>
                  <p className="font-medium text-default">Valida y activa</p>
                  <p className="text-xs text-soft">Dale al botón <strong>🔌 Validar credenciales con Meta</strong> de arriba. Si Meta confirma tu número, marca <strong>“Agente activo”</strong> y guarda. ¡Listo! Tu agente ya responde mensajes reales.</p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
              <p className="font-medium">Recomendado para producción:</p>
              <p className="mt-0.5">Pega también el <strong>App Secret</strong> (Meta → Configuración → Básica) para que verifiquemos la firma de cada mensaje entrante (seguridad anti-suplantación).</p>
            </div>

            <p className="text-xs text-soft">
              ¿Aún no tienes acceso a WhatsApp Cloud API? Debes verificar tu negocio en Meta Business Manager primero (requiere documentos de tu empresa). Mientras tanto, prueba el agente en la pestaña <strong>Playground</strong> sin necesidad de Meta.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Playground: prueba el agente sin Meta
// ─────────────────────────────────────────────────────────────────────────────

type PlaygroundMessage = {
  role: 'user' | 'agent' | 'error';
  content: string;
  toolCalls?: { name: string; args: any; result: string }[];
  at: string;
};

const SUGGESTIONS = [
  '¿qué productos tienes en stock?',
  'busca el café premium',
  '¿cuál es la dirección de la empresa?',
  'cuántas unidades hay del SKU FIN-PROD',
  'quiero comprar 2 unidades de FIN-PROD para entregar',
];

function Playground({ apiUrl, headers }: { apiUrl: string; headers: Record<string, string> }) {
  const [input, setInput] = useState('');
  const [phone, setPhone] = useState('573001234567');
  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTools, setShowTools] = useState(true);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setMessages((m) => [...m, { role: 'user', content: msg, at: new Date().toISOString() }]);
    setInput('');
    setLoading(true);
    try {
      const res = await axios.post(
        `${apiUrl}/agents/whatsapp/test`,
        { message: msg, phoneNumber: phone || 'PLAYGROUND' },
        { headers, timeout: 60000 },
      );
      const data = res.data;
      if (!data.ok) {
        setMessages((m) => [...m, { role: 'error', content: data.error || 'Error desconocido', at: new Date().toISOString() }]);
      } else {
        setMessages((m) => [
          ...m,
          { role: 'agent', content: data.answer, toolCalls: data.toolCalls, at: new Date().toISOString() },
        ]);
      }
    } catch (e: any) {
      const errMsg = e?.response?.data?.error || e?.response?.data?.message || e.message;
      setMessages((m) => [...m, { role: 'error', content: errMsg, at: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    try {
      await axios.post(`${apiUrl}/agents/whatsapp/test/reset`, {}, { headers });
    } catch {}
    setMessages([]);
  };

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="border rounded-xl p-4 text-sm" style={{ background: 'linear-gradient(135deg, rgba(163,204,57,0.12), rgba(11,18,32,0.04))', borderColor: 'rgba(163,204,57,0.22)' }}>
        <p className="font-semibold text-default mb-1">🧪 Modo prueba (sin Meta)</p>
        <p className="text-soft text-xs leading-relaxed">
          Conversa con el agente como si fueras un cliente final por WhatsApp. El agente usa tu catálogo
          real, tu inventario, tus clientes. No necesitas Meta configurado — solo la <code className="surface-2 px-1 rounded">DEEPSEEK_API_KEY</code> en
          Vercel. Cuando ya conectes Meta, el agente responderá igual pero por WhatsApp real.
        </p>
      </div>

      {/* Chat */}
      <div className="surface rounded-xl border flex flex-col h-[520px]">
        <div className="px-4 py-3 border-b border-default flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-default">Simulador de cliente</p>
            <p className="text-xs text-soft">Te respondes como si fueras un cliente</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <label className="text-xs text-soft flex items-center gap-1">
              📱 Tel sim:
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="surface border rounded px-2 py-1 text-xs text-default font-mono w-32"
              />
            </label>
            <label className="text-xs text-soft flex items-center gap-1">
              <input type="checkbox" checked={showTools} onChange={(e) => setShowTools(e.target.checked)} />
              ver tools
            </label>
            <button onClick={reset} className="text-xs text-soft hover:text-default underline">
              Limpiar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 app-bg">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-soft mb-4">Escribe algo o usa una sugerencia:</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs surface border text-default rounded-full px-3 py-1.5 hover:border-emerald-400 hover:bg-emerald-50 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i}>
                <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                      m.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : m.role === 'error'
                        ? 'bg-red-50 text-red-900 border border-red-200'
                        : 'surface text-default border'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${m.role === 'user' ? 'text-emerald-100' : 'text-soft'}`}>
                      {m.role === 'user' ? '👤 Tú (cliente)' : m.role === 'error' ? '⚠️ Error' : '🤖 Agente'}
                    </p>
                  </div>
                </div>
                {showTools && m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="ml-2 mt-1 space-y-1">
                    {m.toolCalls.map((tc, j) => (
                      <details key={j} className="border rounded-lg px-3 py-1.5 text-xs" style={{ backgroundColor: 'rgba(163,204,57,0.10)', borderColor: 'rgba(163,204,57,0.22)' }}>
                        <summary className="cursor-pointer text-brand font-mono">
                          🔧 {tc.name}({JSON.stringify(tc.args).slice(0, 80)}{JSON.stringify(tc.args).length > 80 ? '...' : ''})
                        </summary>
                        <pre className="text-[10px] text-soft overflow-x-auto mt-1 whitespace-pre-wrap">
                          {tc.result.length > 500 ? tc.result.slice(0, 500) + '...' : tc.result}
                        </pre>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="surface border rounded-2xl px-4 py-2.5 text-sm shadow-sm">
                <span className="inline-block animate-pulse">🤖 Agente pensando…</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-default flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Escribe un mensaje como cliente..."
            disabled={loading}
            className="flex-1 surface border rounded-lg px-3 py-2 text-sm text-default disabled:opacity-50"
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
