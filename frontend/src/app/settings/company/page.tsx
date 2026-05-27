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

const EMPTY: CompanyForm = { name: '', taxId: '', address: '', phone: '', email: '' };

export default function SettingsCompanyPage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<CompanyForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    axios
      .get(`${API}/companies/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.data) {
          setForm({
            name: r.data.name ?? '',
            taxId: r.data.taxId ?? '',
            address: r.data.address ?? '',
            phone: r.data.phone ?? '',
            email: r.data.email ?? '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre de la empresa es requerido.'); return; }
    const token = localStorage.getItem('token');
    if (!token) return;
    setSaving(true);
    try {
      await axios.patch(`${API}/companies/my`, form, { headers: { Authorization: `Bearer ${token}` } });
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
            className="text-sm text-slate-500 hover:text-slate-900 mb-3 inline-flex items-center gap-1"
          >
            ← Configuración
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Datos de empresa</h1>
          <p className="text-sm text-slate-500 mt-0.5">Esta información aparece en tus facturas electrónicas.</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Nombre de la empresa *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Mi Empresa S.A.S."
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">NIT / RUC / RFC</label>
                <input
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                  placeholder="900123456-7"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Teléfono</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+57 300 000 0000"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Correo de contacto</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="facturacion@empresa.com"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Dirección</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Cra 7 # 10-20, Bogotá"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
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
