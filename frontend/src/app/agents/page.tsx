'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Agent { type: string; name: string; icon: string; desc: string; minPlan: string; available: boolean }
interface Msg { role: 'user' | 'agent'; text: string; upgrade?: boolean; suggestions?: { label: string; prompt: string }[] }

const STARTERS: Record<string, string[]> = {
  facturacion: ['¿Cómo va mi facturación este mes?', '¿Tengo facturas sin IVA?'],
  configuracion: ['¿Qué me falta configurar?', '¿Cómo dejo lista mi cuenta?'],
  migracion: ['¿Cómo importo mis clientes?', '¿Qué formato usa el Excel?'],
  inventario: ['¿Qué productos debo reponer?', '¿Qué está sin stock?'],
  crm: ['¿Qué clientes están inactivos?', '¿A quién debo dar seguimiento?'],
  cobranza: ['¿Qué facturas están vencidas?', '¿A quién cobro primero?'],
  ejecutivo: ['Dame un resumen del negocio', '¿Cuáles son mis riesgos?'],
};

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [plan, setPlan] = useState('FREE');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    axios.get(`${API}/agents`, { headers })
      .then(r => { setAgents(r.data.agents); setPlan(r.data.plan); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openAgent = (a: Agent) => {
    setActive(a);
    setRemaining(null);
    setMessages([{ role: 'agent', text: `Hola, soy el ${a.name}. ${a.desc} ¿En qué te ayudo?` }]);
  };

  const ask = async (q?: string) => {
    const question = q ?? input;
    if (!question.trim() || !active || asking) return;
    // Build conversation history from prior turns (map our roles to the API's roles).
    const history = messages
      .filter(m => m.text)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
    setMessages(m => [...m, { role: 'user', text: question }]);
    setInput('');
    setAsking(true);
    try {
      const res = await axios.post(`${API}/agents/${active.type}/ask`, { question, history }, { headers });
      const d = res.data || {};
      if (typeof d.remaining === 'number') setRemaining(d.remaining);
      setMessages(m => [...m, { role: 'agent', text: d.answer || 'No pude procesar tu pregunta.', upgrade: !!d.upgrade, suggestions: d.suggestions }]);
    } catch (err: any) {
      setMessages(m => [...m, { role: 'agent', text: err.response?.data?.message || 'No pude procesar tu pregunta.' }]);
    } finally { setAsking(false); }
  };

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-default border-t-brand rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-default">Agentes IA</h1>
          <p className="text-sm text-soft mt-0.5">Asistentes inteligentes que conocen los datos de tu negocio.</p>
        </div>

        {!active ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agents.map(a => (
              <div key={a.type}
                className={`surface rounded-xl border p-4 ${a.available ? 'hover:border-brand cursor-pointer' : 'opacity-70'}`}
                onClick={() => a.available && openAgent(a)}>
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{a.icon}</span>
                  {!a.available && (
                    <span className="text-xs px-2 py-0.5 rounded-full text-ink-900" style={{ backgroundColor: 'rgba(163,204,57,0.18)' }}>Plan {a.minPlan}</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-default mt-2">{a.name}</p>
                <p className="text-xs text-soft mt-0.5">{a.desc}</p>
                {a.available ? (
                  <p className="text-xs text-brand font-medium mt-2">Abrir agente →</p>
                ) : (
                  <Link href="/pricing" className="text-xs text-brand font-medium mt-2 inline-block" onClick={e => e.stopPropagation()}>
                    Desbloquear con plan {a.minPlan} →
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="surface rounded-xl border overflow-hidden flex flex-col" style={{ height: '70vh' }}>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-default flex items-center gap-2">
              <button onClick={() => setActive(null)} className="text-soft hover:text-default text-sm">←</button>
              <span className="text-lg">{active.icon}</span>
              <span className="text-sm font-semibold text-default">{active.name}</span>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${m.role === 'user' ? 'bg-ink-900 text-white' : 'surface-2 text-default'}`}>
                    <p className="text-sm whitespace-pre-line">{m.text}</p>
                    {m.suggestions && m.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.suggestions.map((s, j) => (
                          <button key={j} onClick={() => ask(s.prompt)}
                            className="text-xs surface text-brand border px-2.5 py-1 rounded-full hover:border-brand">
                            {s.label} →
                          </button>
                        ))}
                      </div>
                    )}
                    {m.upgrade && (
                      <Link href="/pricing"
                        className="inline-block text-xs bg-brand text-ink-900 font-semibold px-3 py-1.5 rounded-full mt-2 hover:bg-brand-300">
                        Mejorar plan →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
              {asking && (
                <div className="flex justify-start">
                  <div className="surface-2 rounded-2xl px-3.5 py-2.5">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Starters */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {(STARTERS[active.type] || []).map(s => (
                  <button key={s} onClick={() => ask(s)}
                    className="text-xs text-brand border px-2.5 py-1 rounded-full hover:border-brand"
                    style={{ backgroundColor: 'rgba(163,204,57,0.10)', borderColor: 'rgba(163,204,57,0.22)' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {/* Input */}
            <div className="p-3 border-t border-default flex gap-2">
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && ask()}
                placeholder="Escribe tu pregunta…"
                className="flex-1 surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand" />
              <button onClick={() => ask()} disabled={asking || !input.trim()}
                className="bg-brand text-ink-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-300 disabled:opacity-40">
                Enviar
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
