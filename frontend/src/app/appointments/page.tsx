'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';
import LoadError from '@/components/LoadError';
import { useToast } from '@/contexts/ToastContext';

const API = process.env.NEXT_PUBLIC_API_URL;

type Status = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

interface Appointment {
  id: string;
  customerName: string;
  customerPhone?: string;
  professional?: string;
  serviceName: string;
  startAt: string;
  durationMin: number;
  status: Status;
  notes?: string;
}

interface ServiceProduct {
  id: string;
  name: string;
  type?: string;
  durationMin?: number;
}

const STATUS_META: Record<Status, { label: string; chip: string; dot: string }> = {
  scheduled: { label: 'Agendada', chip: 'surface-2 text-soft', dot: 'bg-slate-400' },
  confirmed: { label: 'Confirmada', chip: 'bg-brand-50 text-ink-900', dot: 'bg-brand' },
  completed: { label: 'Completada', chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelada', chip: 'bg-rose-100 text-rose-600', dot: 'bg-rose-400' },
  no_show: { label: 'No asistió', chip: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
};

// Local YYYY-MM-DD (avoids UTC drift from toISOString).
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtEndTime(iso: string, durationMin: number): string {
  return fmtTime(new Date(new Date(iso).getTime() + durationMin * 60000).toISOString());
}

function fmtHumanDate(key: string): string {
  if (!key) return '—';
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const s = date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const EMPTY_FORM = {
  customerName: '',
  customerPhone: '',
  serviceName: '',
  professional: '',
  time: '09:00',
  durationMin: '30',
  notes: '',
};

export default function AppointmentsPage() {
  const router = useRouter();
  const toast = useToast();
  // Empieza vacío para que el HTML del server coincida con el del cliente (evita hydration mismatch #418).
  // La fecha "hoy" se calcula solo en el cliente vía useEffect.
  const [dateKey, setDateKey] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<ServiceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    // Setear "hoy" solo en cliente (evita hydration mismatch)
    setDateKey(toDateKey(new Date()));
    fetchServices(token);
  }, [router]);

  useEffect(() => {
    if (!dateKey) return; // espera a que se fije la fecha del cliente
    fetchDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  const fetchDay = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await axios.get(`${API}/appointments/day`, {
        params: { date: dateKey },
        headers: { Authorization: `Bearer ${token}` },
      });
      setAppointments(res.data);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  };

  const fetchServices = async (token: string) => {
    try {
      const res = await axios.get(`${API}/products`, {
        params: { type: 'service' },
        headers: { Authorization: `Bearer ${token}` },
      });
      const list: ServiceProduct[] = Array.isArray(res.data) ? res.data : [];
      setServices(list.filter((p) => !p.type || p.type === 'service'));
    } catch { /* services are optional suggestions */ }
  };

  const shiftDay = (delta: number) => {
    const [y, m, d] = dateKey.split('-').map(Number);
    const next = new Date(y, m - 1, d + delta);
    setDateKey(toDateKey(next));
  };

  const isToday = dateKey === toDateKey(new Date());

  const onPickService = (name: string) => {
    const match = services.find((s) => s.name === name);
    setForm((f) => ({
      ...f,
      serviceName: name,
      durationMin: match?.durationMin ? String(match.durationMin) : f.durationMin,
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName.trim()) { toast.error('El nombre del cliente es requerido.'); return; }
    if (!form.serviceName.trim()) { toast.error('El servicio es requerido.'); return; }
    if (!form.time) { toast.error('La hora es requerida.'); return; }
    const token = localStorage.getItem('token');
    if (!token) return;

    const [hh, mm] = form.time.split(':').map(Number);
    const [y, m, d] = dateKey.split('-').map(Number);
    const startAt = new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();

    setSaving(true);
    try {
      await axios.post(`${API}/appointments`, {
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim() || undefined,
        professional: form.professional.trim() || undefined,
        serviceName: form.serviceName.trim(),
        startAt,
        durationMin: form.durationMin ? parseInt(form.durationMin, 10) : 30,
        notes: form.notes.trim() || undefined,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Cita agendada correctamente.');
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchDay();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos agendar la cita. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: Status) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setActingId(id);
    // optimistic
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      await axios.patch(`${API}/appointments/${id}`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Cita marcada como ${STATUS_META[status].label.toLowerCase()}.`);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No pudimos actualizar la cita.');
      fetchDay();
    } finally {
      setActingId(null);
    }
  };

  const waLink = (phone?: string) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    // assume Colombia if no country code length
    const withCc = digits.length === 10 ? `57${digits}` : digits;
    return `https://wa.me/${withCc}`;
  };

  const dayTotals = useMemo(() => {
    const active = appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show');
    return { count: appointments.length, active: active.length };
  }, [appointments]);

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-default">Agenda</h1>
            <p className="text-sm text-soft mt-0.5">
              {dayTotals.count === 0
                ? 'Sin citas este día'
                : `${dayTotals.count} cita${dayTotals.count !== 1 ? 's' : ''}${dayTotals.active !== dayTotals.count ? ` · ${dayTotals.active} activa${dayTotals.active !== 1 ? 's' : ''}` : ''}`}
            </p>
          </div>
          <button
            onClick={() => { setForm({ ...EMPTY_FORM }); setShowForm(true); }}
            className="bg-brand text-ink-900 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-brand-300 transition-colors flex-shrink-0"
          >
            + Cita
          </button>
        </div>

        {/* Date picker bar */}
        <div className="surface rounded-2xl border p-3 mb-6 flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => shiftDay(-1)}
            aria-label="Día anterior"
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-default text-soft hover:bg-surface-2 hover:text-default transition-colors flex-shrink-0"
          >
            ‹
          </button>
          <button
            onClick={() => setDateKey(toDateKey(new Date()))}
            disabled={isToday}
            className={`px-3 h-9 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
              isToday ? 'bg-brand-50 text-brand cursor-default' : 'border border-default text-soft hover:bg-surface-2'
            }`}
          >
            Hoy
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-sm font-semibold text-default truncate">{fmtHumanDate(dateKey)}</p>
          </div>
          <input
            type="date"
            value={dateKey}
            onChange={(e) => e.target.value && setDateKey(e.target.value)}
            className="h-9 px-2 rounded-lg border border-default text-sm text-soft focus:outline-none focus:ring-2 ring-brand flex-shrink-0"
          />
          <button
            onClick={() => shiftDay(1)}
            aria-label="Día siguiente"
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-default text-soft hover:bg-surface-2 hover:text-default transition-colors flex-shrink-0"
          >
            ›
          </button>
        </div>

        {/* Body */}
        {loadError ? (
          <LoadError onRetry={fetchDay} />
        ) : loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-14 h-14 surface-2 rounded-lg animate-pulse flex-shrink-0" />
                <div className="flex-1 h-20 surface-2 rounded-xl animate-pulse" />
              </div>
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="surface rounded-2xl border text-center py-16 px-6">
            <div className="text-4xl mb-3 opacity-30">🗓️</div>
            <p className="text-default font-medium mb-1">No hay citas para este día</p>
            <p className="text-sm text-soft mb-5">Agenda una cita y aparecerá aquí en la línea de tiempo.</p>
            <button
              onClick={() => { setForm({ ...EMPTY_FORM }); setShowForm(true); }}
              className="inline-block bg-brand text-ink-900 px-5 py-2 rounded-xl text-sm font-semibold hover:bg-brand-300"
            >
              Agendar cita →
            </button>
          </div>
        ) : (
          <div className="relative">
            {/* timeline rail */}
            <div className="absolute left-[58px] top-2 bottom-2 w-px hidden sm:block" style={{ backgroundColor: 'var(--border)' }} />
            <div className="space-y-3">
              {appointments.map((a) => {
                const meta = STATUS_META[a.status];
                const muted = a.status === 'cancelled' || a.status === 'no_show';
                const wa = waLink(a.customerPhone);
                const busy = actingId === a.id;
                return (
                  <div key={a.id} className="flex gap-3 sm:gap-4">
                    {/* time column */}
                    <div className="flex flex-col items-end sm:items-center w-12 sm:w-[46px] flex-shrink-0 pt-3">
                      <span className={`text-sm font-bold tabular-nums ${muted ? 'text-soft' : 'text-default'}`}>{fmtTime(a.startAt)}</span>
                      <span className="text-[11px] text-soft tabular-nums">{fmtEndTime(a.startAt, a.durationMin)}</span>
                    </div>

                    {/* dot */}
                    <div className="relative hidden sm:flex flex-col items-center pt-4 flex-shrink-0">
                      <span className={`w-3 h-3 rounded-full ring-4 ${meta.dot}`} style={{ ['--tw-ring-color' as any]: 'var(--bg)' }} />
                    </div>

                    {/* card */}
                    <div className={`flex-1 surface rounded-2xl border p-4 transition-shadow hover:shadow-sm ${muted ? 'opacity-70' : ''}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${muted ? 'text-soft line-through' : 'text-default'}`}>{a.customerName}</p>
                          <p className="text-sm text-soft truncate">{a.serviceName}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-soft">
                            <span>{a.durationMin} min</span>
                            {a.professional && <span>· {a.professional}</span>}
                            {a.customerPhone && <span>· {a.customerPhone}</span>}
                          </div>
                          {a.notes && <p className="text-xs text-soft mt-1.5 italic">{a.notes}</p>}
                        </div>
                        <span className={`text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${meta.chip}`}>
                          {meta.label}
                        </span>
                      </div>

                      {/* quick actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-default">
                        {a.status !== 'confirmed' && a.status !== 'completed' && a.status !== 'cancelled' && (
                          <button
                            onClick={() => updateStatus(a.id, 'confirmed')}
                            disabled={busy}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg text-brand hover:bg-brand-50 disabled:opacity-50"
                          >
                            Confirmar
                          </button>
                        )}
                        {a.status !== 'completed' && a.status !== 'cancelled' && (
                          <button
                            onClick={() => updateStatus(a.id, 'completed')}
                            disabled={busy}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            Completar
                          </button>
                        )}
                        {a.status !== 'cancelled' && a.status !== 'completed' && (
                          <button
                            onClick={() => updateStatus(a.id, 'cancelled')}
                            disabled={busy}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        )}
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium px-2.5 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50 ml-auto inline-flex items-center gap-1"
                          >
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => !saving && setShowForm(false)}
        >
          <div
            className="surface w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border shadow-xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-default sticky top-0 surface">
              <div>
                <h2 className="text-base font-semibold text-default">Nueva cita</h2>
                <p className="text-xs text-soft">{fmtHumanDate(dateKey)}</p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-soft hover:text-default text-xl leading-none w-8 h-8 flex items-center justify-center"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-default mb-1">Cliente *</label>
                <input
                  value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="Nombre del cliente" required
                  className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-default mb-1">Teléfono</label>
                <input
                  value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  placeholder="+57 300 000 0000"
                  className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-default mb-1">Profesional</label>
                <input
                  value={form.professional} onChange={(e) => setForm({ ...form, professional: e.target.value })}
                  placeholder="Quién atiende"
                  className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-default mb-1">Servicio *</label>
                <input
                  value={form.serviceName}
                  onChange={(e) => onPickService(e.target.value)}
                  placeholder="Ej: Corte de cabello, Consulta..."
                  list="service-suggestions"
                  required
                  className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
                {services.length > 0 && (
                  <datalist id="service-suggestions">
                    {services.map((s) => <option key={s.id} value={s.name} />)}
                  </datalist>
                )}
                {services.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {services.slice(0, 6).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onPickService(s.name)}
                        className="text-xs px-2 py-1 rounded-md border border-default text-soft hover:border-brand hover:bg-brand-50 transition-colors"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-default mb-1">Hora *</label>
                <input
                  type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required
                  className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-default mb-1">Duración (min)</label>
                <input
                  type="number" min={5} step={5} value={form.durationMin}
                  onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
                  placeholder="30"
                  className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-default mb-1">Notas</label>
                <textarea
                  value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2} placeholder="Detalles o recordatorios"
                  className="w-full surface border rounded-lg px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 ring-brand resize-none"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end gap-3 pt-1">
                <button
                  type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-soft hover:text-default border border-default rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={saving}
                  className="px-5 py-2 bg-brand text-ink-900 rounded-lg text-sm font-semibold hover:bg-brand-300 disabled:opacity-50"
                >
                  {saving ? 'Agendando...' : 'Agendar cita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
