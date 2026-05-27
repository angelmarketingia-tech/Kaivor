'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Agent { type: string; name: string; icon: string; desc: string; minPlan: string; available: boolean }
interface Msg { role: 'user' | 'agent'; text: string; suggestions?: { label: string; action: string }[] }

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
    setMessages([{ role: 'agent', text: `Hola, soy el ${a.name}. ${a.desc} ¿En qué te ayudo?` }]);
  };

  const ask = async (q?: string) => {
    const question = q ?? input;
    if (!question.trim() || !active) return;
    setMessages(m => [...m, { role: 'user', text: question }]);
    setInput('');
    setAsking(true);
    try {
      const res = await axios.post(`${API}/agents/${active.type}/ask`, { question }, { headers });
      setMessages(m => [...m, { role: 'agent', text: res.data.answer, suggestions: res.data.suggestions }]);
    } catch (err: any) {
      setMessages(m => [...m, { role: 'agent', text: err.response?.data?.message || 'No pude procesar tu pregunta.' }]);
    } finally { setAsking(false); }
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
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Agentes IA</h1>
          <p className="text-sm text-slate-500 mt-0.5">Asistentes inteligentes que conocen los datos de tu negocio.</p>
        </div>

        {!active ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agents.map(a => (
              <div key={a.type}
                className={`bg-white rounded-xl border p-4 ${a.available ? 'border-slate-200 hover:border-violet-300 cursor-pointer' : 'border-slate-200 opacity-70'}`}
                onClick={() => a.available && openAgent(a)}>
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{a.icon}</span>
                  {!a.available && (
                    <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Plan {a.minPlan}</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-900 mt-2">{a.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{a.desc}</p>
                {a.available ? (
                  <p className="text-xs text-violet-600 font-medium mt-2">Abrir agente →</p>
                ) : (
                  <Link href="/pricing" className="text-xs text-violet-600 font-medium mt-2 inline-block" onClick={e => e.stopPropagation()}>
                    Desbloquear con plan {a.minPlan} →
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col" style={{ height: '70vh' }}>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <button onClick={() => setActive(null)} className="text-slate-400 hover:text-slate-700 text-sm">←</button>
              <span className="text-lg">{active.icon}</span>
              <span className="text-sm font-semibold text-slate-900">{active.name}</span>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}>
                    <p className="text-sm whitespace-pre-line">{m.text}</p>
                    {m.suggestions && m.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.suggestions.map((s, j) => (
                          <Link key={j} href={s.action}
                            className="text-xs bg-white text-violet-700 border border-violet-200 px-2.5 py-1 rounded-full hover:bg-violet-50">
                            {s.label} →
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {asking && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl px-3.5 py-2.5">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
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
                    className="text-xs bg-violet-50 text-violet-700 border border-violet-100 px-2.5 py-1 rounded-full hover:bg-violet-100">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {/* Input */}
            <div className="p-3 border-t border-slate-100 flex gap-2">
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && ask()}
                placeholder="Escribe tu pregunta…"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <button onClick={() => ask()} disabled={asking || !input.trim()}
                className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-40">
                Enviar
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
