'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import AdminShell from '@/components/AdminShell';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => n.toLocaleString('es-CO');
const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="surface rounded-xl border p-4">
      <p className="text-xs text-soft uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ?? 'text-default'}`}>{value}</p>
      {sub && <p className="text-xs text-soft mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true); setError(false);
    const token = localStorage.getItem('token');
    axios.get(`${API}/admin/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  return (
    <AdminShell>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-default mb-1">Resumen de la plataforma</h1>
        <p className="text-sm text-soft mb-6">Estado general de Kaivor en tiempo real.</p>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-24 surface rounded-xl animate-pulse" />)}
          </div>
        ) : error ? (
          <div className="surface rounded-xl border p-8 text-center">
            <p className="text-sm text-soft mb-3">No pudimos cargar las métricas.</p>
            <button onClick={load} className="bg-ink-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-ink-700">Reintentar</button>
          </div>
        ) : data && (
          <div className="space-y-6">
            {/* Empresas y usuarios */}
            <div>
              <h2 className="text-xs font-semibold text-soft uppercase tracking-wide mb-2">Empresas y usuarios</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Empresas" value={fmt(data.tenants.total)} sub={`${data.tenants.active} activas · ${data.tenants.inactive} inactivas`} />
                <Stat label="Usuarios" value={fmt(data.users.total)} />
                <Stat label="Registros hoy" value={fmt(data.registrations.today)} accent="text-emerald-600" />
                <Stat label="Registros mes" value={fmt(data.registrations.month)} />
              </div>
            </div>

            {/* Facturación */}
            <div>
              <h2 className="text-xs font-semibold text-soft uppercase tracking-wide mb-2">Actividad</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Facturas total" value={fmt(data.invoices.total)} />
                <Stat label="Facturas mes" value={fmt(data.invoices.month)} />
                <Stat label="Tráfico hoy" value={fmt(data.trafficToday)} sub="eventos" />
                <Stat label="MRR estimado" value={fmtMoney(data.mrr)} accent="text-brand" />
              </div>
            </div>

            {/* Planes */}
            <div>
              <h2 className="text-xs font-semibold text-soft uppercase tracking-wide mb-2">Planes</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {(['FREE', 'STARTER', 'PRO_AI', 'BUSINESS', 'ENTERPRISE'] as const).map(p => (
                  <Stat key={p} label={p.replace('_', ' ')} value={fmt(data.plans[p] ?? 0)} />
                ))}
              </div>
            </div>

            {/* Conversión */}
            <div>
              <h2 className="text-xs font-semibold text-soft uppercase tracking-wide mb-2">Conversión</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Registro → factura" value={`${data.conversion.firstInvoice}%`} accent="text-emerald-600" />
                <Stat label="Free → plan pago" value={`${data.conversion.paid}%`} accent="text-brand" />
                <Stat label="Membresías pendientes" value={fmt(data.pendingMemberships)} accent={data.pendingMemberships > 0 ? 'text-amber-600' : undefined} />
                <Stat label="Errores abiertos" value={fmt(data.openErrors)} accent={data.openErrors > 0 ? 'text-red-600' : undefined} />
              </div>
            </div>

            {/* Uso de funciones */}
            <div>
              <h2 className="text-xs font-semibold text-soft uppercase tracking-wide mb-2">Uso de funciones</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="WhatsApp" value={fmt(data.featureUsage.whatsapp)} sub="mensajes" />
                <Stat label="IA / Agentes" value={fmt(data.featureUsage.ai)} sub="consultas" />
                <Stat label="Inventario" value={fmt(data.featureUsage.inventory)} sub="productos" />
                <Stat label="CRM" value={fmt(data.featureUsage.crm)} sub="clientes" />
              </div>
            </div>

            {/* Acciones rápidas */}
            <div className="surface rounded-xl border p-4">
              <h2 className="text-sm font-semibold text-default mb-3">Acciones rápidas</h2>
              <div className="flex flex-wrap gap-2">
                <Link href="/admin/customers" className="text-sm bg-ink-900 text-white px-3 py-1.5 rounded-lg hover:bg-ink-700">Ver clientes</Link>
                <Link href="/admin/errors" className="text-sm surface-2 text-default px-3 py-1.5 rounded-lg hover:bg-brand-50">Ver errores ({data.openErrors})</Link>
                <Link href="/admin/support" className="text-sm surface-2 text-default px-3 py-1.5 rounded-lg hover:bg-brand-50">Tickets ({data.openTickets})</Link>
                <Link href="/admin/billing" className="text-sm surface-2 text-default px-3 py-1.5 rounded-lg hover:bg-brand-50">Membresías</Link>
                <Link href="/admin/traffic" className="text-sm surface-2 text-default px-3 py-1.5 rounded-lg hover:bg-brand-50">Ver tráfico</Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
