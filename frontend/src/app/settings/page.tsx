'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function SettingsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<string>('FREE');
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token) { router.push('/auth/login'); return; }
    if (userData) setUser(JSON.parse(userData));
    axios
      .get(`${API}/subscriptions/current`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setPlan(r.data.plan))
      .catch(() => {});
  }, [router]);

  const PLAN_LABEL: Record<string, string> = {
    FREE: 'Gratis', STARTER: 'Starter', PRO_AI: 'Pro AI', BUSINESS: 'Business', ENTERPRISE: 'Enterprise',
  };

  const sections = [
    {
      title: 'Empresa',
      description: 'Nombre, NIT, dirección y datos fiscales de tu empresa.',
      href: '/settings/company',
      icon: '◻',
      color: 'text-slate-600',
    },
    {
      title: 'Facturación y plan',
      description: `Plan actual: ${PLAN_LABEL[plan] ?? plan}. Gestiona tu suscripción y límites.`,
      href: '/settings/billing',
      icon: '◈',
      color: 'text-violet-600',
    },
    {
      title: 'Integraciones',
      description: 'WhatsApp, correo, WooCommerce y canales de comunicación.',
      href: '/settings/integrations',
      icon: '⟳',
      color: 'text-blue-600',
    },
    {
      title: 'Kaivor AI',
      description: 'Resumen de ventas e IA aplicada a tu operación.',
      href: '/ai-insights',
      icon: '✦',
      color: 'text-violet-600',
    },
  ];

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestiona tu cuenta, empresa y preferencias.</p>
        </div>

        {/* Account card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 truncate">{user?.name ?? 'Usuario'}</p>
            <p className="text-sm text-slate-500 truncate">{user?.email ?? ''}</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
            plan === 'FREE' ? 'bg-slate-100 text-slate-600' :
            plan === 'PRO_AI' ? 'bg-violet-100 text-violet-700' :
            'bg-emerald-100 text-emerald-700'
          }`}>
            {PLAN_LABEL[plan] ?? plan}
          </span>
        </div>

        {/* Sections grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition-all group flex flex-col gap-3"
            >
              <div className={`text-2xl ${s.color}`}>{s.icon}</div>
              <div>
                <p className="font-semibold text-slate-900 group-hover:text-slate-700">{s.title}</p>
                <p className="text-sm text-slate-500 mt-0.5">{s.description}</p>
              </div>
              <span className="text-xs text-slate-400 group-hover:text-slate-600 mt-auto">Configurar →</span>
            </Link>
          ))}
        </div>

        {/* Danger zone */}
        <div className="mt-8 bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Sesión</h2>
          <p className="text-sm text-slate-500 mb-4">Cierra sesión en este dispositivo.</p>
          <button
            onClick={() => { localStorage.clear(); router.push('/auth/login'); }}
            className="text-sm text-red-600 hover:text-red-700 font-medium border border-red-200 hover:border-red-300 px-4 py-2 rounded-lg transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
