'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

const STARTERS = [
  '¿Cuántos clientes tenemos?',
  '¿Cuánto falta por cobrar?',
  '¿Cuánto hemos facturado este mes?',
  '¿Qué facturas vencidas hay?',
  '¿Qué productos tienen stock bajo?',
  '¿Qué proveedores tienen saldo pendiente?',
];

interface Msg { role: 'user' | 'ai'; text: string }

export default function AssistantPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'ai', text: 'Hola, soy el asistente de Kaivor. Pregúntame sobre tus clientes, facturas, cartera, inventario, proveedores, empleados o nómina.' },
  ]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { if (!token) router.push('/auth/login'); }, []);

  const ask = async (q?: string) => {
    const question = q ?? input;
    if (!question.trim()) return;
    setMessages(m => [...m, { role: 'user', text: question }]);
    setInput('');
    setAsking(true);
    try {
      const res = await axios.post(`${API}/assistant/ask`, { question }, { headers });
      setMessages(m => [...m, { role: 'ai', text: res.data.answer }]);
    } catch (err: any) {
      setMessages(m => [...m, { role: 'ai', text: err.response?.data?.message || 'No pude procesar tu pregunta.' }]);
    } finally { setAsking(false); }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Asistente Kaivor</h1>
        <p className="text-sm text-slate-500 mb-4">Pregunta sobre cualquier área de tu empresa.</p>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col" style={{ height: '70vh' }}>
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
              placeholder="Escribe tu pregunta…"
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
