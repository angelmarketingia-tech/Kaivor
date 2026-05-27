import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/contexts/ToastContext';

export const metadata: Metadata = {
  title: 'Kaivor — Factura gratis. Conecta tu tienda. Automatiza tu operación.',
  description: 'Plataforma de facturación electrónica para PYMEs Colombia. DIAN, WooCommerce e IA.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
