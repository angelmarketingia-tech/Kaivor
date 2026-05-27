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
          <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm shadow-lg">{toast}</div>
        )}

        <div className="mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Agente WhatsApp</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Asistente automático que responde por WhatsApp usando tu catálogo y datos.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Mensajes este mes</p>
              <p className="text-lg font-semibold text-slate-900">
                {config ? `${config.monthlyMessageCount} / ${config.monthlyMessageLimit}` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-4">
          {(['playground', 'conversations', 'config'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
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
            webhookUrl={webhookUrl}
            saving={savingCfg}
            onSave={saveConfig}
          />
        )}

        {tab === 'conversations' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
            {/* List */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden md:col-span-1">
              <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700">
                Recientes
              </div>
              <div className="overflow-y-auto h-full">
                {conversations.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8 px-4">
                    Aún no hay conversaciones. Cuando un cliente escriba a tu WhatsApp Business, aparecerá aquí.
                  </p>
                ) : conversations.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition ${
                      selected === c.id ? 'bg-emerald-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm text-slate-900">+{c.phoneNumber}</p>
                      {c.unreadCount > 0 && (
                        <span className="bg-emerald-600 text-white text-xs px-1.5 rounded-full">{c.unreadCount}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {c.messages[0]?.content || '—'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        c.status === 'taken_over_by_human' ? 'bg-amber-100 text-amber-800' :
                        c.status === 'paused' ? 'bg-slate-100 text-slate-600' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {c.status === 'taken_over_by_human' ? 'Humano' :
                         c.status === 'paused' ? 'Pausado' : 'Agente'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(c.lastMessageAt).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit' } as any)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail */}
            <div className="bg-white rounded-xl border border-slate-200 md:col-span-2 flex flex-col overflow-hidden">
              {!selected || !convDetail ? (
                <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                  Selecciona una conversación
                </div>
              ) : (
                <>
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <p className="font-medium text-sm text-slate-900">+{convDetail.phoneNumber}</p>
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
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                    {convDetail.messages.map(m => (
                      <div
                        key={m.id}
                        className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                          m.role === 'user' ? 'bg-white text-slate-900 border border-slate-200' :
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
                    <div className="p-3 border-t border-slate-100 flex gap-2">
                      <input
                        type="text"
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendReply()}
                        placeholder="Responder al cliente..."
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
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

function ConfigPanel({ config, webhookUrl, saving, onSave }: {
  config: Config; webhookUrl: string; saving: boolean;
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

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
  };

  return (
    <div className="space-y-5">
      {/* Webhook URL */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-emerald-900 mb-1">URL de Webhook Meta</h3>
        <p className="text-xs text-emerald-800 mb-2">
          Configura este URL en Meta Business → WhatsApp → Configuration → Webhook:
        </p>
        <div className="flex gap-2">
          <code className="flex-1 bg-white px-3 py-2 rounded border border-emerald-300 text-xs break-all">
            {webhookUrl}
          </code>
          <button onClick={copyWebhook} className="bg-emerald-600 text-white px-3 py-2 rounded text-xs">
            Copiar
          </button>
        </div>
      </div>

      {/* General */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">General</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={e => setForm({ ...form, enabled: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Agente activo (responde automáticamente)</span>
          </label>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Nombre del agente</label>
            <input
              type="text"
              value={form.agentName}
              onChange={e => setForm({ ...form, agentName: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">
              Prompt del sistema (personaliza cómo se comporta el agente)
            </label>
            <textarea
              value={form.systemPrompt}
              onChange={e => setForm({ ...form, systemPrompt: e.target.value })}
              rows={6}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Límite mensual de mensajes</label>
            <input
              type="number"
              value={form.monthlyMessageLimit}
              onChange={e => setForm({ ...form, monthlyMessageLimit: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Meta Credentials */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Credenciales Meta WhatsApp Cloud API</h3>
        <p className="text-xs text-slate-500 mb-4">
          Obtén estos valores en{' '}
          <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener" className="text-emerald-600 underline">
            Meta Developers Console
          </a>
          .
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">
              Phone Number ID <span className="text-slate-400">(ej: 102345678901234)</span>
            </label>
            <input
              type="text"
              value={form.metaPhoneNumberId}
              onChange={e => setForm({ ...form, metaPhoneNumberId: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">
              WhatsApp Business Account ID (WABA)
            </label>
            <input
              type="text"
              value={form.metaWabaId}
              onChange={e => setForm({ ...form, metaWabaId: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">
              Access Token {config.hasAccessToken && <span className="text-emerald-600">· (configurado)</span>}
            </label>
            <input
              type="password"
              placeholder={config.hasAccessToken ? '••• configurado · pega uno nuevo para cambiar' : 'EAA...'}
              value={form.metaAccessToken}
              onChange={e => setForm({ ...form, metaAccessToken: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">
              Webhook Verify Token <span className="text-slate-400">(elige tú una contraseña aleatoria)</span>
            </label>
            <input
              type="text"
              value={form.metaWebhookVerifyToken}
              onChange={e => setForm({ ...form, metaWebhookVerifyToken: e.target.value })}
              placeholder="kaivor-secret-xyz-123"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
            />
            <p className="text-xs text-slate-400 mt-1">
              Lo necesitarás también en Meta Webhook Settings.
            </p>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">
              App Secret (opcional, para verificar firma HMAC){config.hasAppSecret && <span className="text-emerald-600"> · configurado</span>}
            </label>
            <input
              type="password"
              placeholder={config.hasAppSecret ? '••• configurado' : 'opcional'}
              value={form.metaAppSecret}
              onChange={e => setForm({ ...form, metaAppSecret: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-40"
        >
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
        <p className="font-semibold mb-1">⚠️ Setup requerido (lo hace el cliente una sola vez):</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Verificar Meta Business Manager (con documentos de empresa)</li>
          <li>Tener un número de WhatsApp Business dedicado (NO el personal)</li>
          <li>Solicitar acceso a WhatsApp Cloud API en Meta Developers</li>
          <li>Pegar las credenciales aquí + configurar webhook en Meta apuntando al URL de arriba</li>
        </ol>
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
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm">
        <p className="font-semibold text-violet-900 mb-1">🧪 Modo prueba (sin Meta)</p>
        <p className="text-violet-800 text-xs leading-relaxed">
          Conversa con el agente como si fueras un cliente final por WhatsApp. El agente usa tu catálogo
          real, tu inventario, tus clientes. No necesitas Meta configurado — solo la <code className="bg-violet-100 px-1 rounded">DEEPSEEK_API_KEY</code> en
          Vercel. Cuando ya conectes Meta, el agente responderá igual pero por WhatsApp real.
        </p>
      </div>

      {/* Chat */}
      <div className="bg-white rounded-xl border border-slate-200 flex flex-col h-[520px]">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Simulador de cliente</p>
            <p className="text-xs text-slate-500">Te respondes como si fueras un cliente</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <label className="text-xs text-slate-500 flex items-center gap-1">
              📱 Tel sim:
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="border border-slate-200 rounded px-2 py-1 text-xs font-mono w-32"
              />
            </label>
            <label className="text-xs text-slate-500 flex items-center gap-1">
              <input type="checkbox" checked={showTools} onChange={(e) => setShowTools(e.target.checked)} />
              ver tools
            </label>
            <button onClick={reset} className="text-xs text-slate-500 hover:text-slate-900 underline">
              Limpiar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-slate-400 mb-4">Escribe algo o usa una sugerencia:</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:border-emerald-400 hover:bg-emerald-50 transition"
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
                        : 'bg-white text-slate-900 border border-slate-200'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${m.role === 'user' ? 'text-emerald-100' : 'text-slate-400'}`}>
                      {m.role === 'user' ? '👤 Tú (cliente)' : m.role === 'error' ? '⚠️ Error' : '🤖 Agente'}
                    </p>
                  </div>
                </div>
                {showTools && m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="ml-2 mt-1 space-y-1">
                    {m.toolCalls.map((tc, j) => (
                      <details key={j} className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-1.5 text-xs">
                        <summary className="cursor-pointer text-violet-700 font-mono">
                          🔧 {tc.name}({JSON.stringify(tc.args).slice(0, 80)}{JSON.stringify(tc.args).length > 80 ? '...' : ''})
                        </summary>
                        <pre className="text-[10px] text-slate-600 overflow-x-auto mt-1 whitespace-pre-wrap">
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
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-sm shadow-sm">
                <span className="inline-block animate-pulse">🤖 Agente pensando…</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-100 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Escribe un mensaje como cliente..."
            disabled={loading}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
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
