'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const PLATFORM_ROLES = ['platform_superadmin', 'platform_admin', 'platform_support', 'platform_billing', 'platform_ops'];

const NAV = [
  { href: '/admin/dashboard', label: 'Resumen',     icon: '⊞' },
  { href: '/admin/customers', label: 'Clientes',    icon: '◉' },
  { href: '/admin/traffic',   label: 'Tráfico',     icon: '◔' },
  { href: '/admin/errors',    label: 'Errores',     icon: '⚠' },
  { href: '/admin/support',   label: 'Soporte',     icon: '✆' },
  { href: '/admin/billing',   label: 'Membresías',  icon: '◈' },
  { href: '/admin/automations', label: 'Automatización', icon: '⚡' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [staffName, setStaffName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.platformRole && PLATFORM_ROLES.includes(user.platformRole)) {
        setAllowed(true);
        setStaffName(user.name || user.email || 'Staff');
      } else {
        setAllowed(false);
      }
    } catch { setAllowed(false); }
  }, [router]);

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-slate-300 rounded-full animate-spin" />
      </div>
    );
  }

  if (allowed === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-xl border border-slate-200 p-8 max-w-md text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Acceso restringido</h2>
          <p className="text-sm text-slate-500 mb-5">
            Esta es la consola interna de Kaivor. Solo el equipo de la plataforma puede acceder.
          </p>
          <Link href="/dashboard" className="inline-block bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700">
            Volver a mi cuenta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-slate-950 text-slate-300 shrink-0">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white tracking-tight">Kaivor</span>
            <span className="text-[10px] bg-violet-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">Admin</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Consola interna</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}>
                <span className="text-base opacity-80">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-slate-800">
          <p className="text-xs text-slate-400 truncate mb-2">{staffName}</p>
          <Link href="/dashboard" className="text-xs text-slate-500 hover:text-slate-300">← Volver a la app</Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden bg-slate-950 text-white px-4 py-3 flex items-center gap-2 overflow-x-auto">
          <span className="text-sm font-bold shrink-0">Kaivor Admin</span>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}
              className={`text-xs px-2 py-1 rounded shrink-0 ${pathname === item.href ? 'bg-violet-600' : 'bg-slate-800'}`}>
              {item.label}
            </Link>
          ))}
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
