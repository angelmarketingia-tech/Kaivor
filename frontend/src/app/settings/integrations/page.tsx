'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

type Status = 'ok' | 'pending' | 'error' | 'soon' | 'plan';

interface Card {
  id: string;
  icon: string;
  title: string;
  desc: string;
  status: Status;
  statusLabel: string;
  href?: string;
  cta?: string;
}

const STATUS_STYLE: Record<Status, string> = {
  ok: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
  soon: 'surface-2 text-soft',
  plan: 'bg-brand-50 text-brand',
};

export default function IntegrationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    Promise.allSettled([
      axios.get(`${API}/settings/tenant`, { headers }),
      axios.get(`${API}/integrations`, { headers }),
      axios.get(`${API}/companies/my`, { headers }),
      axios.get(`${API}/messages`, { headers }),
    ]).then(([tenantRes, intRes, compRes, msgRes]) => {
      const tenant = tenantRes.status === 'fulfilled' ? tenantRes.value.data : {};
      const integrations = intRes.status === 'fulfilled' ? intRes.value.data : [];
      const company = compRes.status === 'fulfilled' ? compRes.value.data : {};
      const messages = msgRes.status === 'fulfilled' ? msgRes.value.data : [];

      const woo = Array.isArray(integrations) ? integrations.find((i: any) => i.provider === 'woocommerce') : null;
      const waConfigured = !!tenant.waBusinessPhone;
      const emailConfigured = !!tenant.emailConfigured;
      const fiscalOk = company.taxId && !String(company.taxId).startsWith('TEMP-');

      setCards([
        {
          id: 'whatsapp', icon: '💬', title: 'WhatsApp',
          desc: 'Envía facturas y recordatorios de pago a tus clientes por WhatsApp.',
          status: waConfigured ? 'ok' : 'pending',
          statusLabel: waConfigured ? 'Configurado' : 'No configurado',
          href: '/settings/whatsapp', cta: waConfigured ? 'Administrar' : 'Configurar',
        },
        {
          id: 'email', icon: '✉️', title: 'Correo / Gmail SMTP',
          desc: 'Envía facturas en PDF y recordatorios por email desde tu propio correo.',
          status: emailConfigured ? 'ok' : 'pending',
          statusLabel: emailConfigured ? 'Configurado' : 'No configurado',
          href: '/settings/email', cta: emailConfigured ? 'Administrar' : 'Configurar',
        },
        {
          id: 'messages', icon: '📨', title: 'Centro de mensajería',
          desc: `Historial de mensajes enviados por WhatsApp y email. ${messages.length} mensaje${messages.length === 1 ? '' : 's'} registrado${messages.length === 1 ? '' : 's'}.`,
          status: messages.length > 0 ? 'ok' : 'pending',
          statusLabel: messages.length > 0 ? 'Activo' : 'Sin actividad',
          href: '/messages', cta: 'Ver mensajes',
        },
        {
          id: 'dian', icon: '🏛️', title: 'DIAN — Facturación electrónica',
          desc: 'Datos fiscales de tu empresa para emisión de facturas. Emisión electrónica próximamente.',
          status: fiscalOk ? 'ok' : 'pending',
          statusLabel: fiscalOk ? 'Datos fiscales OK' : 'Falta NIT',
          href: '/settings/company', cta: 'Configurar datos fiscales',
        },
        {
          id: 'woocommerce', icon: '🛒', title: 'WooCommerce',
          desc: 'Sincroniza pedidos y clientes de tu tienda WooCommerce automáticamente.',
          status: woo ? (woo.status === 'connected' ? 'ok' : 'error') : 'pending',
          statusLabel: woo ? (woo.status === 'connected' ? 'Conectado' : 'Desconectado') : 'No conectado',
          href: '/integrations/woocommerce', cta: woo ? 'Administrar' : 'Conectar tienda',
        },
        {
          id: 'payments', icon: '💳', title: 'Integraciones de pago',
          desc: 'Configura Nequi, Daviplata, tarjetas, QR y Addi para cobrar en tus facturas.',
          status: 'pending', statusLabel: 'Configurable',
          href: '/settings/payment-integrations', cta: 'Configurar pagos',
        },
        {
          id: 'imports', icon: '📊', title: 'Importar desde Excel',
          desc: 'Migra clientes, productos e inventario desde archivos Excel/CSV.',
          status: 'soon', statusLabel: 'Próximamente',
        },
        {
          id: 'automations', icon: '⚡', title: 'Automatizaciones',
          desc: 'Automatiza recordatorios de cobro, alertas de stock y seguimiento de clientes.',
          status: 'soon', statusLabel: 'Próximamente',
        },
        {
          id: 'agents', icon: '✦', title: 'Agentes IA',
          desc: 'Asistentes inteligentes para facturación, inventario, CRM y cobranza.',
          status: 'soon', statusLabel: 'Próximamente',
        },
      ]);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-default border-t-brand rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <button onClick={() => router.push('/settings')}
            className="text-sm text-soft hover:text-default mb-2 inline-flex items-center gap-1">
            ← Configuración
          </button>
          <h1 className="text-2xl font-bold text-default">Integraciones</h1>
          <p className="text-sm text-soft mt-0.5">Conecta Kaivor con tus herramientas y canales de comunicación.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map(card => {
            const inner = (
              <div className={`surface rounded-xl border p-5 h-full flex flex-col transition-colors ${card.href ? 'hover:border-brand cursor-pointer' : 'opacity-75'}`}>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-2xl">{card.icon}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[card.status]}`}>
                    {card.statusLabel}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-default">{card.title}</h3>
                <p className="text-xs text-soft mt-1 flex-1">{card.desc}</p>
                {card.href ? (
                  <span className="text-xs font-medium text-brand mt-3 inline-block">{card.cta} →</span>
                ) : (
                  <span className="text-xs text-soft mt-3 inline-block">Disponible en una próxima actualización</span>
                )}
              </div>
            );
            return card.href
              ? <Link key={card.id} href={card.href}>{inner}</Link>
              : <div key={card.id}>{inner}</div>;
          })}
        </div>
      </div>
    </AppLayout>
  );
}
