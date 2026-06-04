'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/contexts/ToastContext';

const API = process.env.NEXT_PUBLIC_API_URL;

interface CompanyForm {
  name: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
}

interface Vertical {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

const EMPTY: CompanyForm = { name: '', taxId: '', address: '', phone: '', email: '' };

export default function SettingsCompanyPage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<CompanyForm>(EMPTY);
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [businessType, setBusinessType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${API}/companies/verticals`, { headers }).catch(() => null),
      axios.get(`${API}/companies/my`, { headers }).catch(() => null),
    ])
      .then(([vRes, cRes]) => {
        if (vRes?.data?.verticals) setVerticals(vRes.data.verticals);
        if (cRes?.data) {
          setForm({
            name: cRes.data.name ?? '',
            taxId: cRes.data.taxId ?? '',
            address: cRes.data.address ?? '',
            phone: cRes.data.phone ?? '',
            email: cRes.data.email ?? '',
          });
          setBusinessType(cRes.data.businessType ?? cRes.data.vertical?.id ?? '');
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre de la empresa es requerido.'); return; }
    const token = localStorage.getItem('token');
    if (!token) return;
    setSaving(true);
    try {
      const payload = businessType ? { ...form, businessType } : form;
      await axios.patch(`${API}/companies/my`, payload, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Datos de empresa actualizados.');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/settings')}
            className="text-sm text-soft hover:text-default mb-3 inline-flex items-center gap-1"
          >
            ← Configuración
          </button>
          <h1 className="text-2xl font-bold text-default">Datos de empresa</h1>
          <p className="text-sm text-soft mt-0.5">Esta información aparece en tus facturas electrónicas.</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 surface-2 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="surface rounded-xl border p-6">
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-default mb-1.5">Nombre de la empresa *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Mi Empresa S.A.S."
                  required
                  className="w-full surface border rounded-lg px-3 py-2.5 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-default mb-1.5">NIT / RUC / RFC</label>
                <input
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                  placeholder="900123456-7"
                  className="w-full surface border rounded-lg px-3 py-2.5 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-default mb-1.5">Teléfono</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+57 300 000 0000"
                  className="w-full surface border rounded-lg px-3 py-2.5 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-default mb-1.5">Correo de contacto</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="facturacion@empresa.com"
                  className="w-full surface border rounded-lg px-3 py-2.5 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-default mb-1.5">Dirección</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Cra 7 # 10-20, Bogotá"
                  className="w-full surface border rounded-lg px-3 py-2.5 text-sm text-default focus:outline-none focus:ring-2 ring-brand"
                />
              </div>

              {verticals.length > 0 && (
                <div className="sm:col-span-2 pt-2 border-t border-default">
                  <label className="block text-sm font-semibold text-default mb-1">Tipo de negocio</label>
                  <p className="text-xs text-soft mb-3">
                    Esto adapta tu facturación y recibos (propina, mesa, servicios, etc.).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {verticals.map((v) => {
                      const active = businessType === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setBusinessType(v.id)}
                          className={`text-left rounded-xl border p-3 transition-colors ${
                            active
                              ? 'border-brand bg-brand-50 ring-2 ring-brand'
                              : 'border-default surface hover:border-brand'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg leading-none">{v.emoji}</span>
                            <span className={`text-sm font-medium ${active ? 'text-brand' : 'text-default'}`}>
                              {v.label}
                            </span>
                          </div>
                          {v.description && (
                            <p className="text-xs text-soft mt-1 leading-snug">{v.description}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="sm:col-span-2 flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-ink-900 text-white rounded-lg text-sm font-medium hover:bg-ink-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
