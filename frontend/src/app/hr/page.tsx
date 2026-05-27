'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

const SECTIONS = [
  { href: '/hr/employees', icon: '👤', title: 'Empleados', desc: 'Gestiona la información de tu equipo.' },
  { href: '/hr/payroll', icon: '💵', title: 'Nómina', desc: 'Periodos de nómina y pagos.' },
  { href: '/hr/pending-balances', icon: '⏳', title: 'Saldos pendientes', desc: 'Anticipos, préstamos y bonificaciones.' },
  { href: '/hr/vacancies', icon: '📋', title: 'Vacantes', desc: 'Procesos de selección y candidatos.' },
  { href: '/hr/ai', icon: '✦', title: 'Kairos HR AI', desc: 'Pregunta sobre tu equipo y nómina.' },
];

export default function HrHubPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    axios.get(`${API}/hr/summary`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setData(r.data))
      .catch(err => { if (err.response?.status === 403) setLocked(true); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <AppLayout><div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div></AppLayout>
  );

  if (locked) return (
    <AppLayout>
      <div className="p-6 max-w-md mx-auto mt-16 text-center">
        <div className="bg-white rounded-xl border border-violet-200 p-8">
          <div className="text-4xl mb-3">🏢</div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Recursos Humanos</h2>
          <p className="text-sm text-slate-500 mb-5">
            El módulo de RRHH, nómina y vacantes está disponible en los planes Business y Enterprise.
          </p>
          <Link href="/pricing" className="inline-block bg-violet-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-violet-700">
            Ver planes →
          </Link>
        </div>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Recursos Humanos</h1>
        <p className="text-sm text-slate-500 mb-6">Gestiona tu equipo, nómina y procesos de selección.</p>

        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 uppercase">Empleados</p>
              <p className="text-xl font-bold text-slate-900">{data.employees.active}<span className="text-sm text-slate-400">/{data.employees.total}</span></p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 uppercase">Nómina pendiente</p>
              <p className="text-xl font-bold text-amber-600">{fmt(data.payroll.pendingAmount)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 uppercase">Saldos pendientes</p>
              <p className="text-xl font-bold text-slate-900">{fmt(data.balances.pendingAmount)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 uppercase">Vacantes abiertas</p>
              <p className="text-xl font-bold text-slate-900">{data.vacancies.open}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SECTIONS.map(s => (
            <Link key={s.href} href={s.href}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-violet-300 transition-colors flex items-start gap-3">
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
