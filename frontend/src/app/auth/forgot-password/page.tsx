'use client';

import { useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/forgot-password`, { email });
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al solicitar restablecimiento. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen app-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-default tracking-tight">Kaivor</h1>
          <p className="text-soft mt-1 text-sm">Recupera el acceso a tu cuenta</p>
        </div>

        <div className="surface rounded-2xl border shadow-sm p-8">
          {done ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-default">Revisa tu correo</h2>
              <div className="bg-green-50 border border-green-100 text-green-800 rounded-xl px-4 py-3 text-sm">
                Si el correo existe, te enviamos un enlace para restablecer tu contraseña. El enlace expira en 1 hora. Revisa también tu carpeta de spam.
              </div>
              <p className="text-xs text-soft text-center">
                ¿No te llega? Escríbenos a <a href="mailto:soporte@kaivor.app" className="text-brand hover:underline">soporte@kaivor.app</a> y te ayudamos a recuperar el acceso.
              </p>
              <Link href="/auth/login" className="block text-center text-sm text-brand hover:underline">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-default mb-2">¿Olvidaste tu contraseña?</h2>
              <p className="text-sm text-soft mb-6">Ingresa tu correo y te enviaremos un enlace para crear una nueva.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-default mb-1.5">Correo electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@empresa.com"
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
                  {loading ? 'Enviando...' : 'Enviar enlace'}
                </button>
              </form>

              <p className="text-center text-sm text-soft mt-6">
                <Link href="/auth/login" className="text-brand font-medium hover:underline">
                  ← Volver al inicio de sesión
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
