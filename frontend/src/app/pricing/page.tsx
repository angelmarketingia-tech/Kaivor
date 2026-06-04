'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL;

const PLANS = [
  {
    key: 'FREE',
    label: 'Gratis',
    price: '$0',
    period: 'para siempre',
    description: 'Empieza facturando gratis. Sin tarjeta de crédito.',
    color: 'border-default',
    badge: '',
    features: ['45 facturas por mes', '1 usuario', 'Clientes y productos', 'Soporte por email'],
    missing: ['WooCommerce', 'Kaivor AI', 'Reportes avanzados'],
    cta: 'Plan actual',
  },
  {
    key: 'STARTER',
    label: 'Starter',
    price: '$19',
    period: '/mes',
    description: 'Más facturas y colaboración básica para crecer.',
    color: 'border-default',
    badge: '',
    features: ['150 facturas por mes', '2 usuarios', 'Soporte prioritario'],
    missing: ['WooCommerce', 'Kaivor AI'],
    cta: 'Elegir Starter',
  },
  {
    key: 'PRO_AI',
    label: 'Pro AI',
    price: '$49',
    period: '/mes',
    description: 'IA, reportes e integración con WooCommerce.',
    color: 'border-brand',
    badge: 'Más popular',
    features: [
      '500 facturas por mes',
      '5 usuarios',
      'Kaivor AI completo',
      'WooCommerce incluido',
      'Reportes avanzados',
      'Soporte prioritario',
    ],
    missing: [],
    cta: 'Elegir Pro AI',
  },
  {
    key: 'BUSINESS',
    label: 'Business',
    price: '$99',
    period: '/mes',
    description: 'Equipos grandes, automatizaciones y ecommerce avanzado.',
    color: 'border-default',
    badge: '',
    features: [
      'Facturas ilimitadas',
      '10 usuarios',
      'Kaivor AI avanzado',
      'WooCommerce + más integraciones',
      'Automatizaciones',
      'Soporte dedicado',
    ],
    missing: [],
    cta: 'Elegir Business',
  },
  {
    key: 'ENTERPRISE',
    label: 'Enterprise',
    price: 'A medida',
    period: '',
    description: 'Solución personalizada para grandes operaciones.',
    color: 'border-default',
    badge: '',
    features: [
      'Facturas ilimitadas',
      'Usuarios ilimitados',
      'IA personalizada',
      'SLA garantizado',
      'Integración a medida',
      'Gerente de cuenta dedicado',
    ],
    missing: [],
    cta: 'Contactar ventas',
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<string>('FREE');
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    const headers = { Authorization: `Bearer ${token}` };
    axios.post(`${API}/events`, { eventName: 'pricing_viewed', path: '/pricing' }, { headers }).catch(() => {});

    axios
      .get(`${API}/subscriptions/current`, { headers })
      .then((r) => setCurrentPlan(r.data.plan))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const changePlan = async (plan: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setChanging(plan);
    try {
      await axios.post(
        `${API}/subscriptions/change-plan`,
        { plan },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setCurrentPlan(plan);
      // Actualizar plan en localStorage
      const userData = localStorage.getItem('user');
      if (userData) {
        const u = JSON.parse(userData);
        localStorage.setItem('user', JSON.stringify({ ...u, plan }));
      }
    } catch {
      /* mostrar error si hace falta */
    } finally {
      setChanging(null);
    }
  };

  return (
    <div className="min-h-screen app-bg">
      <nav className="surface border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-soft hover:text-brand">← Dashboard</Link>
          <span className="text-xl font-bold text-default">Kaivor</span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-default mb-3">
            Empieza facturando gratis.
          </h1>
          <p className="text-soft text-lg max-w-xl mx-auto">
            Desbloquea IA e integraciones cuando tu negocio crezca.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-96 surface-2 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {PLANS.map((plan) => {
              const isActive = currentPlan === plan.key;
              const isLoading = changing === plan.key;
              const isEnterprise = plan.key === 'ENTERPRISE';

              return (
                <div
                  key={plan.key}
                  className={`surface rounded-xl border-2 p-5 flex flex-col relative ${plan.color} ${
                    isActive ? 'ring-2 ring-brand ring-offset-2' : ''
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-ink-900 text-xs px-3 py-1 rounded-full font-medium">
                      {plan.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute -top-3 right-3 bg-emerald-500 text-white text-xs px-2.5 py-0.5 rounded-full font-medium">
                      Activo
                    </span>
                  )}

                  <div className="mb-4">
                    <p className="text-xs font-semibold text-soft uppercase tracking-wide">{plan.label}</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold text-default">{plan.price}</span>
                      {plan.period && <span className="text-xs text-soft">{plan.period}</span>}
                    </div>
                    <p className="text-xs text-soft mt-1.5 leading-relaxed">{plan.description}</p>
                  </div>

                  <ul className="space-y-1.5 mb-5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-default">
                        <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                    {plan.missing.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-soft">
                        <span className="mt-0.5 flex-shrink-0">✗</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isEnterprise ? (
                    <a
                      href="mailto:ventas@kaivor.io?subject=Consulta%20Enterprise"
                      className="w-full py-2 rounded-lg text-sm font-medium text-center bg-ink-900 text-white hover:bg-ink-700 transition-colors block"
                    >
                      {plan.cta}
                    </a>
                  ) : (
                    <button
                      disabled={isActive || isLoading}
                      onClick={() => !isActive && !isEnterprise && changePlan(plan.key)}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'surface-2 text-soft cursor-default'
                          : plan.key === 'PRO_AI'
                          ? 'bg-brand text-ink-900 hover:bg-brand-300 font-semibold'
                          : 'bg-ink-900 text-white hover:bg-ink-700'
                      }`}
                    >
                      {isLoading ? 'Cambiando...' : isActive ? 'Plan actual' : plan.cta}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-soft mt-8">
          Todos los planes incluyen facturación electrónica básica. Sin contratos. Cancela cuando quieras.
        </p>
      </main>
    </div>
  );
}
