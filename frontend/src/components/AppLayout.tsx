'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import BrandLogo from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';

const API = process.env.NEXT_PUBLIC_API_URL;

// Registrar el interceptor de 401 una sola vez a nivel de módulo.
let interceptorRegistered = false;

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  tenantId: string;
  platformRole?: string | null;
  permissions?: Record<string, boolean>;
}

// Cada item de nav declara el permiso que lo habilita. Sin `perm` => siempre visible.
const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Dashboard',     icon: '⊞' },
  { href: '/pos',        label: 'Punto de venta',icon: '◉', highlight: true, perm: 'pos.use' },
  { href: '/reports',    label: 'Reportes',      icon: '◔', perm: 'reports.view' },
  { href: '/tables',     label: 'Mesas',         icon: '▦', verticalFeature: 'table', perm: 'tables.use' },
  { href: '/appointments', label: 'Agenda',      icon: '◷', verticalFeature: 'appointments', perm: 'appointments.use' },
  { href: '/invoices',   label: 'Facturas',      icon: '◻', perm: 'invoices.view' },
  { href: '/customers',  label: 'Clientes',      icon: '◉', perm: 'customers.view' },
  { href: '/products',   label: 'Productos',     icon: '▤', perm: 'products.view' },
  { href: '/inventory',  label: 'Inventario',    icon: '▦', perm: 'inventory.view' },
  { href: '/suppliers',  label: 'Proveedores',   icon: '⛬', perm: 'suppliers.view' },
  { href: '/hr',         label: 'RRHH',          icon: '☶', perm: 'hr.view' },
  { href: '/messages',   label: 'Mensajes',      icon: '✉' },
  { href: '/automations',label: 'Automatización',icon: '⚡', perm: 'ai.use' },
  { href: '/assistant',  label: 'Asistente IA',  icon: '✦', perm: 'ai.use' },
  { href: '/agents',     label: 'Agentes IA',    icon: '◆', perm: 'ai.use' },
  { href: '/accounts',   label: 'Cuentas',       icon: '⌂', perm: 'accounts.view' },
  { href: '/imports',    label: 'Importar',      icon: '↧', perm: 'products.manage' },
  { href: '/settings',   label: 'Configuración', icon: '⚙', perm: 'settings.manage' },
];

// admin/manager y superadmins ven todo el nav sin importar permisos granulares.
function isPrivileged(u: { role?: string; platformRole?: string | null } | null): boolean {
  const r = u?.role;
  return r === 'admin' || r === 'manager' || r === 'platform_superadmin' || r === 'superadmin' || !!u?.platformRole;
}

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
  const [vfeatures, setVfeatures] = useState<Record<string, boolean> | null>(null);

  // Sync the active-account header BEFORE child pages fetch data (runs every render, synchronously).
  if (typeof window !== 'undefined') {
    const acc = localStorage.getItem('activeAccountId');
    if (acc && acc !== 'all') axios.defaults.headers.common['x-account-id'] = acc;
    else delete axios.defaults.headers.common['x-account-id'];
  }

  useEffect(() => {
    // Manejo global de 401: redirige a login al expirar la sesión. Solo se registra una vez.
    if (!interceptorRegistered) {
      interceptorRegistered = true;
      axios.interceptors.response.use(
        (r) => r,
        (err) => {
          if (err?.response?.status === 401) {
            try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch {}
            router.push('/auth/login');
          }
          return Promise.reject(err);
        },
      );
    }
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    const raw = localStorage.getItem('user');
    if (raw) setUser(JSON.parse(raw));
    setActiveAccount(localStorage.getItem('activeAccountId') || 'all');
    // Refrescar el usuario desde el servidor: garantiza platformRole + datos al día
    // (un localStorage viejo no tenía platformRole y rompía el acceso a la Consola).
    axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const fresh = r.data?.user;
        if (fresh) { setUser(fresh); localStorage.setItem('user', JSON.stringify(fresh)); }
      })
      .catch(() => {});
    axios.get(`${API}/accounts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setAccounts(r.data.accounts || []))
      .catch(() => {});
    axios.get(`${API}/companies/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const v = r.data?.vertical;
        setVfeatures(v?.features ? { ...v.features, appointments: !!(v.features.professional || v.features.duration) } : null);
      })
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
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--sidebar-bg)', color: 'var(--sidebar-text)' }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between gap-2">
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0" onClick={() => setSidebarOpen(false)}>
            <BrandLogo size={26} ink="#FFFFFF" showByline />
          </Link>
          <ThemeToggle />
        </div>
        <span className={`inline-block mt-3 text-[10px] px-2 py-0.5 rounded-full font-semibold ${badge.cls}`}>{badge.label}</span>
      </div>

      {/* Account switcher */}
      {accounts.length > 0 && (
        <div className="px-3 pt-3">
          <label className="text-[10px] uppercase tracking-wide font-medium px-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Cuenta</label>
          <select
            value={activeAccount}
            onChange={(e) => switchAccount(e.target.value)}
            className="w-full mt-1 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#E8EDF5', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }}
          >
            <option value="all" style={{ color: '#0B1220' }}>◇ Consolidado (todas)</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id} style={{ color: '#0B1220' }}>{a.name}</option>
            ))}
          </select>
          {activeAccount !== 'all' && (
            <p className="text-[10px] mt-1 px-1 text-brand">Viendo solo esta cuenta</p>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          // Items condicionados a la vertical (Mesas, Agenda): ocultar si no aplica.
          // Mientras carga (vfeatures null) se ocultan para evitar parpadeo de items irrelevantes.
          if ((item as any).verticalFeature) {
            if (!vfeatures || !vfeatures[(item as any).verticalFeature]) return null;
          }
          // Oculta el item si el usuario no tiene el permiso requerido.
          // admin/manager/superadmin ven todo; si aún no cargan los permisos, no ocultamos para evitar parpadeo.
          const perm = (item as any).perm as string | undefined;
          if (perm && user?.permissions && !isPrivileged(user) && user.permissions[perm] !== true) {
            return null;
          }
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const highlight = (item as any).highlight;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all relative"
              style={
                active
                  ? { backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }
                  : highlight
                    ? { color: '#BDDD6B', backgroundColor: 'rgba(163,204,57,0.08)' }
                    : { color: 'var(--sidebar-text)' }
              }
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = highlight ? 'rgba(163,204,57,0.08)' : 'transparent'; }}
            >
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand" />}
              <span className="text-base leading-none opacity-90">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Upgrade CTA (only for Free/Starter) */}
      {(plan === 'FREE' || plan === 'STARTER') && (
        <div className="mx-3 mb-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(163,204,57,0.1)', border: '1px solid rgba(163,204,57,0.2)' }}>
          <p className="text-xs font-semibold mb-0.5 text-brand">Desbloquea Pro AI</p>
          <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>IA, WooCommerce y reportes avanzados.</p>
          <Link
            href="/pricing"
            onClick={() => setSidebarOpen(false)}
            className="block text-center text-xs py-1.5 px-3 rounded-lg font-semibold transition-colors bg-brand text-ink-900 hover:bg-brand-300"
          >
            Ver planes →
          </Link>
        </div>
      )}

      {/* Report problem + admin */}
      <div className="px-3 pb-2 space-y-1">
        <button
          onClick={() => { setReportOpen(true); setSidebarOpen(false); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
          style={{ color: 'var(--sidebar-text)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <span className="text-base opacity-80">✆</span> Reportar problema
        </button>
        {(user?.platformRole || user?.role === 'platform_superadmin' || user?.role === 'superadmin') && (
          <Link
            href="/admin/dashboard"
            onClick={() => setSidebarOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors bg-brand text-ink-900 hover:bg-brand-300"
          >
            <span className="text-base">⚡</span> Consola Kaivor
          </Link>
        )}
      </div>

      {/* User footer */}
      <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        {user && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-brand text-ink-900">
              {user.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#E8EDF5' }}>{user.name}</p>
              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="text-sm transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#F87171')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
            >
              ⏻
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden app-bg">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 flex flex-col w-64 h-full shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden surface border-b px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-soft hover:surface-2"
          >
            ☰
          </button>
          <BrandLogo size={22} />
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
          <ThemeToggle />
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
