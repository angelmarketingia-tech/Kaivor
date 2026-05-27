'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

type Status = 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected';

interface Integration {
  id: string;
  status: string;
  storeUrl: string;
  provider?: string;
  country?: string;
  currency?: string;
  lastSyncAt?: string;
}

export default function WooCommercePage() {
  const router = useRouter();
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<{ url: string; secret: string } | null>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    storeUrl: '',
    consumerKey: '',
    consumerSecret: '',
    country: 'CO',
    currency: 'COP',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    loadData(token);
  }, [router]);

  const loadData = async (token: string) => {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [usageRes, intRes] = await Promise.allSettled([
        axios.get(`${API}/subscriptions/usage`, { headers }),
        axios.get(`${API}/integrations`, { headers }),
      ]);

      if (usageRes.status === 'fulfilled') {
        setHasPlan(usageRes.value.data.features.woocommerce);
      }
      if (intRes.status === 'fulfilled') {
        const woo = (intRes.value.data as Integration[]).find((i) => i.provider === 'woocommerce' || i.status !== 'disconnected');
        if (woo) {
          setIntegration(woo);
          setStatus(woo.status === 'connected' ? 'connected' : 'disconnected');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setStatus('connecting');
    setError('');
    try {
      const res = await axios.post(
        `${API}/integrations/woocommerce/connect`,
        form,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setIntegration(res.data);
      setStatus('connected');
      setWebhookInfo({ url: res.data.webhookUrl, secret: res.data.webhookSecret });
    } catch (err: unknown) {
      setStatus('error');
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'No pudimos conectar tu tienda. Revisa las credenciales.');
    }
  };

  const handleSync = async () => {
    if (!integration) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setSyncing(true);
    try {
      await axios.post(
        `${API}/integrations/woocommerce/${integration.id}/sync`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      loadData(token);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!integration) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    await axios.post(
      `${API}/integrations/${integration.id}/disconnect`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    setIntegration(null);
    setStatus('idle');
    setWebhookInfo(null);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-2xl mx-auto space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">WooCommerce</h1>
          <p className="text-sm text-slate-500 mt-0.5">Conecta tu tienda e importa pedidos automáticamente.</p>
        </div>

        {/* Plan no permite WooCommerce */}
        {hasPlan === false && (
          <div className="bg-white rounded-xl border border-amber-200 p-8 text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">WooCommerce está disponible en Pro AI y Business</h2>
            <p className="text-slate-500 mb-6">
              Conecta tu tienda para importar pedidos automáticamente y convertirlos en facturas.
            </p>
            <Link
              href="/pricing"
              className="inline-block bg-violet-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-violet-700"
            >
              Ver planes →
            </Link>
          </div>
        )}

        {/* Estado: conectado */}
        {hasPlan && integration && status === 'connected' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-emerald-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                  <h2 className="text-lg font-semibold text-slate-900">Tienda conectada</h2>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="text-xs text-red-500 hover:underline"
                >
                  Desconectar
                </button>
              </div>
              <p className="text-sm text-slate-600 mb-1">
                <span className="font-medium">URL:</span> {integration.storeUrl}
              </p>
              {integration.lastSyncAt && (
                <p className="text-sm text-slate-600 mb-4">
                  <span className="font-medium">Última sync:</span>{' '}
                  {new Date(integration.lastSyncAt).toLocaleString('es-CO')}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
                >
                  {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                </button>
                <Link
                  href={`/integrations/woocommerce/logs`}
                  className="border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Ver logs
                </Link>
              </div>
            </div>

            {/* Webhook info — solo visible al conectar */}
            {webhookInfo && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <p className="text-sm font-semibold text-amber-800 mb-3">
                  ⚠️ Guarda esta información — no se mostrará de nuevo
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-amber-700 font-medium mb-1">URL del Webhook</p>
                    <code className="text-xs bg-white border border-amber-200 px-3 py-1.5 rounded block break-all">
                      {webhookInfo.url}
                    </code>
                  </div>
                  <div>
                    <p className="text-xs text-amber-700 font-medium mb-1">Secreto del Webhook</p>
                    <code className="text-xs bg-white border border-amber-200 px-3 py-1.5 rounded block break-all">
                      {webhookInfo.secret}
                    </code>
                  </div>
                </div>
                <p className="text-xs text-amber-600 mt-3">
                  Configura estos valores en WooCommerce → Ajustes → Webhooks
                </p>
              </div>
            )}
          </div>
        )}

        {/* Estado: no conectado — mostrar formulario */}
        {hasPlan && !integration && (status === 'idle' || status === 'error') && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Conectar tienda WooCommerce</h2>
            <p className="text-sm text-slate-500 mb-6">
              Ingresa las credenciales de API de tu tienda. Encontrarás Consumer Key y Consumer Secret en WooCommerce → Ajustes → Avanzado → REST API.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">URL de la tienda</label>
                <input
                  type="url"
                  placeholder="https://mitienda.com"
                  value={form.storeUrl}
                  onChange={(e) => setForm({ ...form, storeUrl: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Consumer Key</label>
                <input
                  type="text"
                  placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={form.consumerKey}
                  onChange={(e) => setForm({ ...form, consumerKey: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Consumer Secret</label>
                <input
                  type="password"
                  placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={form.consumerSecret}
                  onChange={(e) => setForm({ ...form, consumerSecret: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">País</label>
                  <select
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="CO">Colombia</option>
                    <option value="MX">México</option>
                    <option value="AR">Argentina</option>
                    <option value="CL">Chile</option>
                    <option value="PE">Perú</option>
                    <option value="SV">El Salvador</option>
                    <option value="GT">Guatemala</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Moneda</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="COP">COP</option>
                    <option value="MXN">MXN</option>
                    <option value="ARS">ARS</option>
                    <option value="CLP">CLP</option>
                    <option value="PEN">PEN</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={!form.storeUrl || !form.consumerKey || !form.consumerSecret}
                className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Conectar tienda
              </button>
            </div>
          </div>
        )}

        {/* Estado: conectando */}
        {status === 'connecting' && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600 font-medium">Verificando credenciales...</p>
            <p className="text-slate-400 text-sm mt-1">Probando conexión con tu tienda</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
