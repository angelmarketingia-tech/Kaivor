import { NextRequest } from 'next/server';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { getSmtpConfig, sendEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { to } = await req.json().catch(() => ({}));
    const cfg = await getSmtpConfig(jwt.tenant_id);
    if (!cfg) {
      return Response.json({ message: 'Configura el SMTP antes de probar el envío.' }, { status: 400 });
    }
    const dest = to || cfg.fromAddr;
    await sendEmail(
      cfg,
      dest,
      'Correo de prueba — Kaivor',
      `<div style="font-family:Arial,sans-serif;padding:24px;color:#1e293b">
        <h2 style="color:#7c3aed">✓ Conexión exitosa</h2>
        <p>Este es un correo de prueba enviado desde <strong>Kaivor</strong>.</p>
        <p>Tu configuración SMTP funciona correctamente. Ya puedes enviar facturas y recordatorios por email.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">
        <p style="font-size:12px;color:#94a3b8">Servidor: ${cfg.host}:${cfg.port}</p>
      </div>`,
    );
    return Response.json({ ok: true, sentTo: dest });
  } catch (err: any) {
    return Response.json({ message: `Error al enviar: ${err.message || 'verifica tus credenciales SMTP'}` }, { status: 500 });
  }
}
