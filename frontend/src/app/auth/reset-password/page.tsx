'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Falta el token. Solicita un nuevo enlace.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/reset-password`, { token, password });
      setDone(true);
      setTimeout(() => router.push('/auth/login'), 2500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'No se pudo restablecer. El enlace puede haber expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen app-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-default tracking-tight">Kaivor</h1>
          <p className="text-soft mt-1 text-sm">Crea tu nueva contraseña</p>
        </div>

        <div className="surface rounded-2xl border shadow-sm p-8">
          {done ? (
            <div className="space-y-4 text-center">
              <h2 className="text-xl font-semibold text-default">¡Listo!</h2>
              <div className="bg-green-50 border border-green-100 text-green-800 rounded-xl px-4 py-3 text-sm">
                Tu contraseña fue actualizada. Te redirigiremos al inicio de sesión...
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-default mb-6">Nueva contraseña</h2>

              {!token && (
                <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
                  Falta el token. <Link href="/auth/forgot-password" className="underline">Solicita un nuevo enlace</Link>.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-default mb-1.5">Nueva contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full px-4 py-2.5 border border-default rounded-xl text-sm focus:outline-none focus:ring-2 ring-brand focus:border-transparent transition"
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-default mb-1.5">Confirma la contraseña</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repite la contraseña"
                    className="w-full px-4 py-2.5 border border-default rounded-xl text-sm focus:outline-none focus:ring-2 ring-brand focus:border-transparent transition"
                    required
                    minLength={8}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full bg-brand text-ink-900 py-2.5 rounded-xl font-semibold text-sm hover:bg-brand-300 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Guardando...' : 'Cambiar contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen app-bg" />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
