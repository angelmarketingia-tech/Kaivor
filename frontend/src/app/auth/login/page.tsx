'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const router = useRouter();

  const completeLogin = (data: any) => {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    router.push('/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, { email, password });
      if (res.data?.mfaRequired) {
        setMfaUserId(res.data.userId);
        setMfaRequired(true);
        setMfaCode('');
        return;
      }
      if (res.data?.access_token) {
        completeLogin(res.data);
        return;
      }
      setError('No se pudo iniciar sesión. Intenta de nuevo.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Credenciales incorrectas. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/mfa/verify`, {
        userId: mfaUserId,
        code: mfaCode,
      });
      if (res.data?.access_token) {
        completeLogin(res.data);
        return;
      }
      setError('Código inválido. Intenta de nuevo.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Código inválido. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaCancel = () => {
    setMfaRequired(false);
    setMfaUserId('');
    setMfaCode('');
    setError('');
  };

  return (
    <div className="min-h-screen app-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-default tracking-tight">Kaivor</h1>
          <p className="text-soft mt-1 text-sm">Factura gratis. Automatiza tu operación.</p>
        </div>

        <div className="surface rounded-2xl border shadow-sm p-8">
          {!mfaRequired ? (
            <>
              <h2 className="text-xl font-semibold text-default mb-6">Inicia sesión</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-default mb-1.5">Correo o usuario</label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@empresa.com o tu usuario"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="w-full px-4 py-2.5 border border-default rounded-xl text-sm focus:outline-none focus:ring-2 ring-brand focus:border-transparent transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-default mb-1.5">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 border border-default rounded-xl text-sm focus:outline-none focus:ring-2 ring-brand focus:border-transparent transition"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand text-ink-900 py-2.5 rounded-xl font-semibold text-sm hover:bg-brand-300 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </button>

                <div className="text-right">
                  <Link href="/auth/forgot-password" className="text-sm text-soft hover:text-brand hover:underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              </form>

              <p className="text-center text-sm text-soft mt-6">
                ¿No tienes cuenta?{' '}
                <Link href="/auth/register" className="text-brand font-medium hover:underline">
                  Regístrate gratis
                </Link>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-default mb-2">Verificación en dos pasos</h2>
              <p className="text-soft text-sm mb-6">
                Ingresa el código de 6 dígitos de tu app de autenticación.
              </p>

              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-default mb-1.5">Código de verificación</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full px-4 py-2.5 border border-default rounded-xl text-sm tracking-[0.5em] text-center focus:outline-none focus:ring-2 ring-brand focus:border-transparent transition"
                    autoFocus
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  className="w-full bg-brand text-ink-900 py-2.5 rounded-xl font-semibold text-sm hover:bg-brand-300 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Verificando...' : 'Verificar'}
                </button>

                <button
                  type="button"
                  onClick={handleMfaCancel}
                  className="w-full text-sm text-soft hover:text-brand hover:underline"
                >
                  Volver al inicio de sesión
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-soft mt-6">
          Sin tarjeta de crédito · 45 facturas gratis cada mes
        </p>
      </div>
    </div>
  );
}
