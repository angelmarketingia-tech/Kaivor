'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

const STARTERS = [
  '¿Cuántos empleados activos hay?',
  '¿Cuánto está pendiente por pagar en nómina?',
  '¿Qué empleados tienen saldos pendientes?',
  '¿Cuántas vacantes abiertas hay?',
  '¿Qué candidatos están en entrevista?',
  '¿Qué área tiene más empleados?',
];

interface Msg { role: 'user' | 'ai'; text: string }

export default function HrAiPage() {
  const router = useRouter();
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'ai', text: 'Hola, soy Kairos HR AI. Pregúntame sobre tu equipo, nómina, saldos o vacantes.' },
  ]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    axios.get(`${API}/hr/summary`, { headers })
      .then(() => setReady(true))
      .catch(err => { if (err.response?.status === 403) setLocked(true); else setReady(true); });
  }, []);

  const ask = async (q?: string) => {
    const question = q ?? input;
    if (!question.trim()) return;
    setMessages(m => [...m, { role: 'user', text: question }]);
    setInput('');
    setAsking(true);
    try {
      const res = await axios.post(`${API}/hr/ai`, { question }, { headers });
      setMessages(m => [...m, { role: 'ai', text: res.data.answer }]);
    } catch (err: any) {
      setMessages(m => [...m, { role: 'ai', text: err.response?.data?.message || 'No pude procesar tu pregunta.' }]);
    } finally { setAsking(false); }
  };

  if (locked) return (
    <AppLayout><div className="p-6 max-w-md mx-auto mt-16 text-center">
      <div className="bg-white rounded-xl border border-violet-200 p-8">
        <div className="text-4xl mb-3">✦</div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Kairos HR AI</h2>
        <p className="text-sm text-slate-500 mb-5">El asistente de RRHH está disponible en planes Business y Enterprise.</p>
        <Link href="/pricing" className="inline-block bg-violet-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium">Ver planes →</Link>
      </div>
    </div></AppLayout>
  );
  if (!ready) return (
    <AppLayout><div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4 text-sm">
          <Link href="/hr" className="text-slate-500 hover:text-slate-900">RRHH</Link>
          <span className="text-slate-300">/</span><span className="text-slate-900 font-medium">Kairos HR AI</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col" style={{ height: '72vh' }}>
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <span className="text-lg">✦</span>
            <span className="text-sm font-semibold text-slate-900">Kairos HR AI</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  <p className="text-sm whitespace-pre-line">{m.text}</p>
                </div>
              </div>
            ))}
            {asking && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl px-3.5 py-2.5 flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            )}
          </div>
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {STARTERS.map(s => (
                <button key={s} onClick={() => ask(s)}
                  className="text-xs bg-violet-50 text-violet-700 border border-violet-100 px-2.5 py-1 rounded-full hover:bg-violet-100">
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="p-3 border-t border-slate-100 flex gap-2">
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ask()}
              placeholder="Pregunta sobre tu equipo…"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
            <button onClick={() => ask()} disabled={asking || !input.trim()}
              className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-40">
              Enviar
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
