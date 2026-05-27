import nodemailer from 'nodemailer';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  fromName: string;
  fromAddr: string;
}

export async function getSmtpConfig(tenantId: string): Promise<SmtpConfig | null> {
  const s = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  if (!s || !s.smtpHost || !s.smtpUser || !s.smtpPassEnc) return null;
  let pass: string;
  try {
    pass = decrypt(s.smtpPassEnc);
  } catch {
    return null;
  }
  return {
    host: s.smtpHost,
    port: s.smtpPort || 587,
    user: s.smtpUser,
    pass,
    secure: s.smtpSecure,
    fromName: s.emailFromName || s.smtpUser,
    fromAddr: s.emailFromAddr || s.smtpUser,
  };
}

export async function sendEmail(
  cfg: SmtpConfig,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  await transporter.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromAddr}>`,
    to,
    subject,
    html,
  });
}
