'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL;

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  tenantId: string;
  platformRole?: string | null;
}

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Dashboard',     icon: '⊞' },
  { href: '/invoices',   label: 'Facturas',      icon: '◻' },
  { href: '/customers',  label: 'Clientes',      icon: '◉' },
  { href: '/products',   label: 'Productos',     icon: '▤' },
  { href: '/inventory',  label: 'Inventario',    icon: '▦' },
  { href: '/suppliers',  label: 'Proveedores',   icon: '⛬' },
  { href: '/hr',         label: 'RRHH',          icon: '☶' },
  { href: '/messages',   label: 'Mensajes',      icon: '✉' },
  { href: '/automations',label: 'Automatización',icon: '⚡' },
  { href: '/assistant',  label: 'Asistente IA',  icon: '✦' },
  { href: '/agents',     label: 'Agentes IA',    icon: '◆' },
  { href: '/accounts',   label: 'Cuentas',       icon: '⌂' },
  { href: '/imports',    label: 'Importar',      icon: '↧' },
  { href: '/settings',   label: 'Configuración', icon: '⚙' },
];

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  FREE:       { label: 'Free',       cls: 'bg-slate-100 text-slate-600' },
  STARTER:    { label: 'Starter',    cls: 'bg-blue-100 text-blue-700' },
  PRO_AI:     { label: 'Pro AI',     cls: 'bg-violet-100 text-violet-700' },
  BUSINESS:   { label: 'Business',  cls: 'bg-indigo-100 text-indigo-700' },
  ENTERPRISE: { label: 'Enterprise', cls: 'bg-amber-100 text-amber-700' },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState({ category: 'bug', subject: '', description: '', priority: 'medium' });
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [activeAccount, setActiveAccount] = useState<string>('all');

  // Sync the active-account header BEFORE child pages fetch data (runs every render, synchronously).
  if (typeof window !== 'undefined') {
    const acc = localStorage.getItem('activeAccountId');
    if (acc && acc !== 'all') axios.defaults.headers.common['x-account-id'] = acc;
    else delete axios.defaults.headers.common['x-account-id'];
  }

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    const raw = localStorage.getItem('user');
    if (raw) setUser(JSON.parse(raw));
    setActiveAccount(localStorage.getItem('activeAccountId') || 'all');
    axios.get(`${API}/accounts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setAccounts(r.data.accounts || []))
      .catch(() => {});
  }, [router]);

  const switchAccount = (accId: string) => {
    if (accId === 'all') {
      localStorage.removeItem('activeAccountId');
      localStorage.removeItem('activeAccountName');
    } else {
      const acc = accounts.find(a => a.id === accId);
      localStorage.setItem('activeAccountId', accId);
      if (acc) localStorage.setItem('activeAccountName', acc.name);
    }
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/auth/login');
  };

  const submitReport = async () => {
    if (!report.subject.trim() || !report.description.trim()) return;
    setReportState('sending');
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/support/tickets`, report, { headers: { Authorization: `Bearer ${token}` } });
      setReportState('sent');
      setTimeout(() => {
        setReportOpen(false); setReportState('idle');
        setReport({ category: 'bug', subject: '', description: '', priority: 'medium' });
      }, 1800);
    } catch {
      setReportState('idle');
      alert('No pudimos enviar tu reporte. Intenta de nuevo.');
    }
  };

  const plan = user?.plan ?? 'FREE';
  const badge = PLAN_BADGE[plan] ?? PLAN_BADGE.FREE;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
          <span className="text-lg font-bold text-slate-900 tracking-tight">Kaivor</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
        </Link>
      </div>

      {/* Account switcher */}
      {accounts.length > 0 && (
        <div className="px-3 pt-3">
          <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium px-1">Cuenta</label>
          <select
            value={activeAccount}
            onChange={(e) => switchAccount(e.target.value)}
            className="w-full mt-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            <option value="all">◇ Consolidado (todas)</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {activeAccount !== 'all' && (
            <p className="text-[10px] text-violet-600 mt-1 px-1">Viendo solo esta cuenta</p>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="text-base leading-none opacity-80">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Upgrade CTA (only for Free/Starter) */}
      {(plan === 'FREE' || plan === 'STARTER') && (
        <div className="mx-3 mb-3 p-3 bg-violet-50 border border-violet-100 rounded-xl">
          <p className="text-xs font-semibold text-violet-800 mb-0.5">Desbloquea Pro AI</p>
          <p className="text-xs text-violet-600 mb-2">IA, WooCommerce y reportes avanzados.</p>
          <Link
            href="/pricing"
            onClick={() => setSidebarOpen(false)}
            className="block text-center text-xs bg-violet-600 text-white py-1.5 px-3 rounded-lg font-medium hover:bg-violet-700 transition-colors"
          >
            Ver planes →
          </Link>
        </div>
      )}

      {/* Report problem + admin */}
      <div className="px-3 pb-2 space-y-1">
        <button
          onClick={() => { setReportOpen(true); setSidebarOpen(false); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <span className="text-base opacity-80">✆</span> Reportar problema
        </button>
        {user?.platformRole && (
          <Link
            href="/admin/dashboard"
            onClick={() => setSidebarOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 transition-colors"
          >
            <span className="text-base">⚡</span> Consola Kaivor
          </Link>
        )}
      </div>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-slate-100">
        {user && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-bold shrink-0">
              {user.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="text-slate-400 hover:text-red-500 text-sm transition-colors"
            >
              ⏻
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-slate-200 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 flex flex-col w-64 bg-white border-r border-slate-200 h-full shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            ☰
          </button>
          <span className="text-base font-bold text-slate-900">Kaivor</span>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Report problem modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => reportState !== 'sending' && setReportOpen(false)}>
          <div className="bg-white rounded-xl p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            {reportState === 'sent' ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-2">✓</div>
                <p className="text-sm font-semibold text-slate-900">Reporte enviado</p>
                <p className="text-xs text-slate-500 mt-0.5">Gracias. El equipo de Kaivor lo revisará pronto.</p>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Reportar un problema</h3>
                <label className="text-xs text-slate-500 block mb-1">Área afectada</label>
                <select value={report.category} onChange={(e) => setReport((r) => ({ ...r, category: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
                  <option value="bug">Error / falla</option>
                  <option value="question">Pregunta</option>
                  <option value="billing">Facturación / plan</option>
                  <option value="feature">Sugerencia</option>
                  <option value="other">Otro</option>
                </select>
                <label className="text-xs text-slate-500 block mb-1">Asunto</label>
                <input type="text" value={report.subject} onChange={(e) => setReport((r) => ({ ...r, subject: e.target.value }))}
                  placeholder="Resume el problema" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3" />
                <label className="text-xs text-slate-500 block mb-1">Descripción</label>
                <textarea rows={3} value={report.description} onChange={(e) => setReport((r) => ({ ...r, description: e.target.value }))}
                  placeholder="¿Qué pasó? ¿Qué esperabas?" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none mb-3" />
                <label className="text-xs text-slate-500 block mb-1">Prioridad</label>
                <div className="flex gap-2 mb-4">
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button key={p} onClick={() => setReport((r) => ({ ...r, priority: p }))}
                      className={`flex-1 py-1.5 text-xs rounded-lg border ${report.priority === p ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}>
                      {p === 'low' ? 'Baja' : p === 'medium' ? 'Media' : 'Alta'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={submitReport} disabled={reportState === 'sending' || !report.subject.trim() || !report.description.trim()}
                    className="flex-1 bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-40">
                    {reportState === 'sending' ? 'Enviando…' : 'Enviar reporte'}
                  </button>
                  <button onClick={() => setReportOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
