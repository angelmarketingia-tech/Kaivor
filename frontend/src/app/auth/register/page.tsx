'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', companyName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const router = useRouter();

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const companyName = form.companyName.trim();

    if (!name) { setError('Escribe tu nombre completo.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('El correo electrónico no es válido.'); return; }
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (form.password !== form.confirm) { setError('Las contraseñas no coinciden.'); return; }

    setLoading(true);
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        name, email, password: form.password, companyName: companyName || name,
      });
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'No pudimos crear tu cuenta. Revisa tu conexión e intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Kaivor</h1>
          <p className="text-slate-500 mt-1 text-sm">Factura gratis. Conecta tu tienda. Automatiza tu operación.</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-1">Crea tu cuenta gratis</h2>
          <p className="text-sm text-slate-500 mb-6">Sin tarjeta de crédito. 45 facturas al mes incluidas.</p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre completo</label>
              <input
                type="text" value={form.name} onChange={set('name')}
                placeholder="Ana García" autoComplete="name"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre de tu empresa</label>
              <input
                type="text" value={form.companyName} onChange={set('companyName')}
                placeholder="Mi Empresa S.A.S." autoComplete="organization"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              />
              <p className="text-xs text-slate-400 mt-1">Opcional — si lo dejas vacío usaremos tu nombre.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo electrónico</label>
              <input
                type="email" value={form.email} onChange={set('email')}
                placeholder="ana@miempresa.com" autoComplete="email"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                  placeholder="Mínimo 6 caracteres" autoComplete="new-password"
                  className="w-full px-4 py-2.5 pr-16 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                />
                <button type="button" onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700">
                  {showPass ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirma tu contraseña</label>
              <input
                type={showPass ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')}
                placeholder="Repite la contraseña" autoComplete="new-password"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              />
              {form.confirm.length > 0 && form.password !== form.confirm && (
                <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden.</p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-violet-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Creando tu cuenta…' : 'Comenzar gratis →'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="text-violet-600 font-medium hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Al registrarte aceptas nuestros Términos de Servicio y Política de Privacidad.
        </p>
      </div>
    </div>
  );
}
