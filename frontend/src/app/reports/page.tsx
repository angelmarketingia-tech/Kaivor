'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';
import LoadError from '@/components/LoadError';

const API = process.env.NEXT_PUBLIC_API_URL;

interface DailyPoint { date: string; revenue: number; count: number }
interface HourlyPoint { hour: number; revenue: number }
interface WeekdayPoint { day: string; revenue: number }
interface TopProduct { name: string; qty: number; revenue: number }

interface Analytics {
  rangeDays: number;
  totalRevenue: number;
  totalInvoices: number;
  avgTicket: number;
  daily: DailyPoint[];
  hourly: HourlyPoint[];
  weekday: WeekdayPoint[];
  topProducts: TopProduct[];
  insights: { peakHourLabel: string; peakDay: string };
}

interface Suggestions {
  slowMovers: { name: string; price: number; daysSinceCreated: number }[];
  topPerformers: { name: string; revenue: number; qty: number }[];
  comboSuggestion: { a: string; b: string; count: number } | null;
  restockAlerts: { name: string; stock: number; reorderPoint: number }[];
  tips: string[];
}

const RANGES = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
];

const money = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const moneyShort = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
};

export default function ReportsPage() {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [sug, setSug] = useState<Suggestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    fetchData(days, token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const fetchData = async (range: number, token?: string) => {
    const t = token ?? localStorage.getItem('token');
    if (!t) return;
    setLoading(true);
    setLoadError(false);
    const headers = { Authorization: `Bearer ${t}` };
    try {
      const [aRes, sRes] = await Promise.allSettled([
        axios.get(`${API}/pos/sales-analytics?days=${range}`, { headers }),
        axios.get(`${API}/pos/suggestions`, { headers }),
      ]);
      if (aRes.status === 'fulfilled') setData(aRes.value.data);
      else throw new Error('analytics failed');
      if (sRes.status === 'fulfilled') setSug(sRes.value.data);
      else setSug(null);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const hasSales = !!data && data.totalInvoices > 0;

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-default">Reportes</h1>
            <p className="text-sm text-soft mt-0.5">Cómo va tu negocio de un vistazo.</p>
          </div>
          {/* Range selector */}
          <div className="inline-flex surface border rounded-xl p-1 self-start">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  days === r.days
                    ? 'bg-brand text-ink-900'
                    : 'text-soft hover:text-default'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <ReportsSkeleton />
        ) : loadError ? (
          <LoadError onRetry={() => fetchData(days)} />
        ) : !hasSales ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {/* Hero KPIs */}
            <div className="bg-gradient-to-br from-ink-900 to-ink-800 rounded-2xl p-6 text-white">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Ingresos · últimos {data!.rangeDays} días</p>
              <p className="text-4xl sm:text-5xl font-bold tracking-tight">{money(data!.totalRevenue)}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Facturas</p>
                  <p className="text-xl font-semibold mt-0.5">{data!.totalInvoices.toLocaleString('es-CO')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Ticket promedio</p>
                  <p className="text-xl font-semibold mt-0.5">{money(data!.avgTicket)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Hora pico</p>
                  <p className="text-xl font-semibold mt-0.5 text-emerald-400">{data!.insights?.peakHourLabel || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Día fuerte</p>
                  <p className="text-xl font-semibold mt-0.5 text-brand">{data!.insights?.peakDay || '—'}</p>
                </div>
              </div>
            </div>

            {/* Revenue over time */}
            <RevenueChart daily={data!.daily} />

            {/* Hourly + Weekday */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HourlyChart hourly={data!.hourly} peak={data!.insights?.peakHourLabel} />
              <WeekdayChart weekday={data!.weekday} peak={data!.insights?.peakDay} />
            </div>

            {/* Top products */}
            <TopProducts products={data!.topProducts} />

            {/* Smart suggestions */}
            {sug && <SmartSuggestions sug={sug} />}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

/* ---------- Revenue over time (inline SVG area + line) ---------- */
function RevenueChart({ daily }: { daily: DailyPoint[] }) {
  if (!daily || daily.length === 0) {
    return (
      <Card title="Ingresos por día">
        <p className="text-sm text-soft py-8 text-center">Sin datos en el rango.</p>
      </Card>
    );
  }

  const W = 720;
  const H = 200;
  const PAD = 8;
  const max = Math.max(...daily.map((d) => d.revenue), 1);
  const n = daily.length;
  const peakIdx = daily.reduce((best, d, i) => (d.revenue > daily[best].revenue ? i : best), 0);

  const x = (i: number) => (n === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (n - 1));
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);

  const linePts = daily.map((d, i) => `${x(i)},${y(d.revenue)}`).join(' ');
  const areaPts = `${PAD},${H - PAD} ${linePts} ${W - PAD},${H - PAD}`;

  const fmtDate = (s: string) => {
    const d = new Date(s);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  return (
    <Card
      title="Ingresos por día"
      right={<span className="text-xs text-soft">Pico: {money(daily[peakIdx].revenue)} · {fmtDate(daily[peakIdx].date)}</span>}
    >
      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48" preserveAspectRatio="none">
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* baseline */}
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--border)" strokeWidth="1" />
          {/* area */}
          <polygon points={areaPts} fill="url(#revFill)" />
          {/* line */}
          <polyline
            points={linePts}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* peak dot */}
          <circle cx={x(peakIdx)} cy={y(daily[peakIdx].revenue)} r="4" fill="#10b981" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="flex justify-between text-[11px] text-soft mt-1 px-1">
        <span>{fmtDate(daily[0].date)}</span>
        {n > 2 && <span>{fmtDate(daily[Math.floor(n / 2)].date)}</span>}
        <span>{fmtDate(daily[n - 1].date)}</span>
      </div>
    </Card>
  );
}

/* ---------- Hourly bars ---------- */
function HourlyChart({ hourly, peak }: { hourly: HourlyPoint[]; peak?: string }) {
  const data = (hourly || []).filter((h) => h.revenue > 0);
  const max = Math.max(...(hourly || []).map((h) => h.revenue), 1);
  return (
    <Card title="Horas pico" right={peak ? <span className="text-xs font-medium text-emerald-600">{peak}</span> : undefined}>
      {data.length === 0 ? (
        <p className="text-sm text-soft py-6 text-center">Sin datos por hora.</p>
      ) : (
        <div className="flex items-end gap-1 h-32">
          {(hourly || []).map((h) => {
            const pct = (h.revenue / max) * 100;
            const isPeak = h.revenue === max && h.revenue > 0;
            return (
              <div key={h.hour} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                <div
                  className={`w-full rounded-t transition-all ${isPeak ? 'bg-emerald-500' : 'bg-emerald-200 group-hover:bg-emerald-300'}`}
                  style={{ height: `${Math.max(pct, h.revenue > 0 ? 4 : 0)}%` }}
                  title={`${String(h.hour).padStart(2, '0')}:00 · ${money(h.revenue)}`}
                />
              </div>
            );
          })}
        </div>
      )}
      <div className="flex justify-between text-[10px] text-soft mt-1.5">
        <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>
      </div>
    </Card>
  );
}

/* ---------- Weekday bars ---------- */
function WeekdayChart({ weekday, peak }: { weekday: WeekdayPoint[]; peak?: string }) {
  const data = weekday || [];
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <Card title="Días fuertes" right={peak ? <span className="text-xs font-medium text-brand">{peak}</span> : undefined}>
      {data.length === 0 || data.every((d) => d.revenue === 0) ? (
        <p className="text-sm text-soft py-6 text-center">Sin datos por día.</p>
      ) : (
        <div className="flex items-end gap-2 h-32">
          {data.map((d) => {
            const pct = (d.revenue / max) * 100;
            const isPeak = d.revenue === max && d.revenue > 0;
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className={`w-full rounded-t transition-all ${isPeak ? 'bg-brand' : 'bg-brand-200 hover:bg-brand-300'}`}
                  style={{ height: `${Math.max(pct, d.revenue > 0 ? 4 : 0)}%` }}
                  title={`${d.day} · ${money(d.revenue)}`}
                />
              </div>
            );
          })}
        </div>
      )}
      <div className="flex justify-between text-[10px] text-soft mt-1.5">
        {data.map((d) => (
          <span key={d.day} className="flex-1 text-center">{d.day.slice(0, 3)}</span>
        ))}
      </div>
    </Card>
  );
}

/* ---------- Top products ranked list ---------- */
function TopProducts({ products }: { products: TopProduct[] }) {
  const list = products || [];
  const max = Math.max(...list.map((p) => p.revenue), 1);
  return (
    <Card title="Top productos">
      {list.length === 0 ? (
        <p className="text-sm text-soft py-6 text-center">Aún no hay productos vendidos.</p>
      ) : (
        <div className="space-y-3">
          {list.slice(0, 8).map((p, i) => (
            <div key={p.name + i} className="flex items-center gap-3">
              <span className="w-5 text-xs font-bold text-soft text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-default truncate">{p.name}</p>
                  <p className="text-sm font-semibold text-default flex-shrink-0">{money(p.revenue)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-300 to-brand-600"
                      style={{ width: `${(p.revenue / max) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-soft flex-shrink-0 w-14 text-right">{p.qty} und.</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------- Smart suggestions ---------- */
function SmartSuggestions({ sug }: { sug: Suggestions }) {
  const hasAny =
    (sug.tips?.length ?? 0) > 0 ||
    !!sug.comboSuggestion ||
    (sug.restockAlerts?.length ?? 0) > 0 ||
    (sug.slowMovers?.length ?? 0) > 0;

  if (!hasAny) return null;

  return (
    <div
      className="surface rounded-2xl border p-5 sm:p-6"
      style={{ background: 'linear-gradient(135deg, rgba(163,204,57,0.12), rgba(11,18,32,0.04))' }}
    >
      <h2 className="text-base font-semibold text-default flex items-center gap-2 mb-4">
        <span>💡</span> Sugerencias inteligentes
      </h2>

      {/* Tips */}
      {sug.tips?.length > 0 && (
        <div className="space-y-2 mb-4">
          {sug.tips.map((t, i) => (
            <div key={i} className="flex items-start gap-2.5 surface rounded-xl px-3.5 py-2.5">
              <span className="text-brand mt-0.5 text-sm flex-shrink-0">✦</span>
              <p className="text-sm text-default leading-snug">{t}</p>
            </div>
          ))}
        </div>
      )}

      {/* Combo suggestion */}
      {sug.comboSuggestion && (
        <div className="surface rounded-xl px-3.5 py-3 mb-3">
          <p className="text-xs uppercase tracking-wide text-brand font-medium mb-1">Combo sugerido</p>
          <p className="text-sm text-default">
            <span className="font-semibold">{sug.comboSuggestion.a}</span>
            {' + '}
            <span className="font-semibold">{sug.comboSuggestion.b}</span>
            <span className="text-soft"> · se vendieron juntos {sug.comboSuggestion.count} veces</span>
          </p>
        </div>
      )}

      {/* Restock alerts */}
      {sug.restockAlerts?.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-xs uppercase tracking-wide text-amber-600 font-medium">Reabastecer pronto</p>
          {sug.restockAlerts.map((r, i) => (
            <div key={i} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">
              <span className="text-sm font-medium text-slate-800 truncate dark:text-amber-900">{r.name}</span>
              <span className="text-xs text-amber-700 flex-shrink-0 ml-3">
                Quedan {r.stock} · reordenar en {r.reorderPoint}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Slow movers */}
      {sug.slowMovers?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-soft font-medium">Productos estancados</p>
          {sug.slowMovers.slice(0, 4).map((s, i) => (
            <div key={i} className="flex items-center justify-between surface rounded-xl px-3.5 py-2.5">
              <span className="text-sm font-medium text-default truncate">{s.name}</span>
              <span className="text-xs text-soft flex-shrink-0 ml-3">
                {money(s.price)} · {s.daysSinceCreated} días sin moverse
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Reusable card ---------- */
function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="surface rounded-2xl border p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-default">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ---------- Empty state ---------- */
function EmptyState() {
  return (
    <div className="surface rounded-2xl border p-12 text-center">
      <div className="text-5xl mb-4 opacity-40">📊</div>
      <p className="text-default font-semibold mb-1">Aún no hay ventas que mostrar</p>
      <p className="text-sm text-soft max-w-sm mx-auto mb-5">
        En cuanto registres ventas en el punto de venta, aquí verás tus ingresos, horas pico y tus productos estrella.
      </p>
      <a
        href="/pos"
        className="inline-block bg-brand text-ink-900 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-300 transition-colors"
      >
        Ir al punto de venta →
      </a>
    </div>
  );
}

/* ---------- Skeleton ---------- */
function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-44 surface-2 animate-pulse rounded-2xl" />
      <div className="h-64 surface-2 animate-pulse rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-56 surface-2 animate-pulse rounded-2xl" />
        <div className="h-56 surface-2 animate-pulse rounded-2xl" />
      </div>
      <div className="h-72 surface-2 animate-pulse rounded-2xl" />
    </div>
  );
}
