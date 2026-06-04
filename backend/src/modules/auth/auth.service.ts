import { Injectable, Logger, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { encrypt, decrypt } from '@/common/crypto.util';
import { effectivePermissions } from '@/common/permissions';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async register(dto: RegisterDto) {
    const { email, password, name, companyName } = dto;

    const existingUser = await this.prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('El correo ya está registrado');
    }

    // Generar slug único para el tenant
    const baseSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const slug = `${baseSlug}-${Date.now()}`;

    const hashedPassword = await bcrypt.hash(password, 10);

    // Transacción: crear Tenant + User + Company + Subscription
    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const tenant = await tx.tenant.create({
        data: { slug, name: companyName || name, plan: 'FREE' },
      });

      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          tenantId: tenant.id,
          role: 'admin',
        },
      });

      // Empresa principal del tenant
      await tx.company.create({
        data: {
          tenantId: tenant.id,
          name: companyName || name,
          taxId: `TEMP-${tenant.id.slice(0, 8)}`,
        },
      });

      // Crear Subscription FREE
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: 'FREE',
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });

      return { tenant, user };
    });

    const token = this.jwtService.sign({
      sub: result.user.id,
      email: result.user.email,
      tenant_id: result.tenant.id,
      role: result.user.role,
    });

    return {
      access_token: token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        tenantId: result.tenant.id,
        plan: 'FREE',
      },
    };
  }

  async login(dto: LoginDto) {
    const { password } = dto;
    // El identificador puede venir como email O username (login simple del cajero).
    const identifier = (dto.email || dto.username || '').trim();
    if (!identifier) throw new UnauthorizedException('Credenciales inválidas');

    const looksLikeEmail = identifier.includes('@');
    const user = await this.prisma.user.findFirst({
      where: {
        isActive: true,
        ...(looksLikeEmail
          ? { email: identifier.toLowerCase() }
          : { OR: [{ username: identifier }, { email: identifier.toLowerCase() }] }),
      },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // If MFA is enabled, do NOT issue full token. Return a challenge.
    if (user.mfaEnabled) {
      return {
        mfaRequired: true,
        userId: user.id,
        message: 'Ingresa el código de tu app autenticadora',
      };
    }

    // Obtener plan actual
    const subscription = await this.subscriptionsService.getCurrentSubscription(user.tenantId);

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      tenant_id: user.tenantId,
      role: user.role,
    });

    const isPlatformAdmin = user.role === 'platform_superadmin' || user.role === 'superadmin';
    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        platformRole: isPlatformAdmin ? user.role : null,
        tenantId: user.tenantId,
        plan: subscription.plan,
      },
    };
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }

  // ── MFA / TOTP ──

  async mfaSetup(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.mfaEnabled) throw new BadRequestException('MFA ya está habilitado');

    const secret = speakeasy.generateSecret({
      name: `Kaivor (${user.email})`,
      length: 20,
    });

    // Store encrypted secret. NOT enabled yet.
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEnc: encrypt(secret.base32) },
    });

    const otpAuthUrl = secret.otpauth_url || '';
    const qrDataUrl = await qrcode.toDataURL(otpAuthUrl);

    return {
      qr: qrDataUrl,
      secret: secret.base32,
      otpAuthUrl,
      message: 'Escanea el QR con Google Authenticator / Authy. Luego confirma con /auth/mfa/enable.',
    };
  }

  async mfaEnable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecretEnc) throw new BadRequestException('Ejecuta /auth/mfa/setup primero');
    const secret = decrypt(user.mfaSecretEnc);
    const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });
    if (!verified) throw new UnauthorizedException('Código MFA inválido');

    // Generate 8 backup codes (one-time use)
    const backupCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      backupCodes.push(Math.random().toString(36).slice(2, 10).toUpperCase());
    }
    const hashedCodes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 8)));

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaBackupCodes: hashedCodes },
    });

    return { ok: true, backupCodes, message: 'MFA habilitado. Guarda estos códigos de respaldo en un lugar seguro.' };
  }

  async mfaDisable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled || !user.mfaSecretEnc) throw new BadRequestException('MFA no está habilitado');
    const secret = decrypt(user.mfaSecretEnc);
    const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });
    if (!verified) throw new UnauthorizedException('Código MFA inválido');
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecretEnc: null, mfaBackupCodes: Prisma.JsonNull },
    });
    return { ok: true };
  }

  async mfaVerify(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { tenant: true } });
    if (!user || !user.mfaEnabled || !user.mfaSecretEnc) throw new UnauthorizedException('MFA no configurado');
    const secret = decrypt(user.mfaSecretEnc);
    let verified = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });

    // If TOTP failed, try backup codes
    if (!verified && user.mfaBackupCodes) {
      const hashedCodes = user.mfaBackupCodes as string[];
      for (let i = 0; i < hashedCodes.length; i++) {
        if (await bcrypt.compare(code, hashedCodes[i])) {
          verified = true;
          // Remove used backup code
          const remaining = hashedCodes.filter((_, idx) => idx !== i);
          await this.prisma.user.update({ where: { id: userId }, data: { mfaBackupCodes: remaining } });
          break;
        }
      }
    }

    if (!verified) throw new UnauthorizedException('Código MFA inválido');

    const subscription = await this.subscriptionsService.getCurrentSubscription(user.tenantId);
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      tenant_id: user.tenantId,
      role: user.role,
    });
    return {
      access_token: token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId, plan: subscription.plan },
    };
  }

  // ── Password reset ──

  async forgotPassword(email: string) {
    if (!email || typeof email !== 'string' || !email.trim()) {
      throw new BadRequestException('El correo es requerido');
    }
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' }, isActive: true },
    });

    // Always return success to prevent email enumeration
    const genericResponse = { ok: true, message: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña.' };

    if (!user) return genericResponse;
    // Usuarios sin correo (cajeros con login simple) NO se auto-recuperan:
    // su contraseña la restablece el dueño desde /settings/team. Fail-closed.
    if (!user.email) return genericResponse;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt },
    });

    const frontendUrl = (process.env.FRONTEND_URLS || '').split(',')[0]?.trim() || 'https://kaivor.vercel.app';
    const resetLink = `${frontendUrl}/auth/reset-password?token=${rawToken}`;

    const sent = await this.sendResetEmail(user.email, user.name || user.email || 'Usuario', resetLink);

    if (!sent) {
      // Email provider not configured or send failed. FAIL CLOSED:
      // never expose the token/link in the HTTP response (that would be an account-takeover path).
      // Log server-side only so an operator can recover if needed.
      this.logger.error(
        `[forgot-password] No se pudo enviar el correo de reset a ${user.email}. ` +
          `RESEND_API_KEY ${process.env.RESEND_API_KEY ? 'configurada pero el envío falló' : 'NO configurada'}. ` +
          `Reset link (solo logs del servidor): ${resetLink}`,
      );
    }

    // ALWAYS return the generic response — never the token. Prevents enumeration + token disclosure.
    return genericResponse;
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword) throw new BadRequestException('Token y nueva contraseña son requeridos');
    if (newPassword.length < 8) throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!user) throw new BadRequestException('Token inválido o expirado');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });

    return { ok: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' };
  }

  private async sendResetEmail(toEmail: string, toName: string, link: string): Promise<boolean> {
    // Limpiar BOM/zero-width chars que se cuelan al guardar la key vía PowerShell.
    const apiKey = (process.env.RESEND_API_KEY || '').replace(/[﻿​ ]/g, '').trim();
    if (!apiKey) return false;

    const from = (process.env.RESEND_FROM_EMAIL || 'Kaivor <onboarding@resend.dev>').replace(/[﻿​ ]/g, '').trim();

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [toEmail],
          subject: 'Restablecer tu contraseña de Kaivor',
          html: `
            <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#0f172a;">
              <h1 style="font-size:20px;margin:0 0 16px;">Hola ${toName.split(' ')[0] || ''},</h1>
              <p style="font-size:15px;line-height:1.6;color:#334155;">Recibimos una solicitud para restablecer la contraseña de tu cuenta de Kaivor.</p>
              <p style="font-size:15px;line-height:1.6;color:#334155;">Haz clic en el botón para crear una nueva. Este enlace expira en <strong>1 hora</strong>.</p>
              <p style="margin:24px 0;">
                <a href="${link}" style="background:#0f172a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:500;display:inline-block;">Restablecer contraseña</a>
              </p>
              <p style="font-size:13px;color:#64748b;">Si el botón no funciona, copia este enlace en tu navegador:</p>
              <p style="font-size:13px;color:#64748b;word-break:break-all;">${link}</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
              <p style="font-size:12px;color:#94a3b8;">Si no solicitaste esto, ignora este correo. Tu contraseña seguirá igual.</p>
            </div>
          `,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error('[Resend] Failed to send:', res.status, errBody);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[Resend] Exception sending email:', e);
      return false;
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, tenantId: true, isActive: true, permissions: true, mfaEnabled: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const subscription = await this.subscriptionsService.getCurrentSubscription(user.tenantId);
    const isPlatformAdmin = user.role === 'platform_superadmin' || user.role === 'superadmin';
    const permissions = effectivePermissions(user.role, (user.permissions as any) || null);
    const { permissions: _raw, ...rest } = user;
    return { user: { ...rest, platformRole: isPlatformAdmin ? user.role : null, plan: subscription.plan, permissions } };
  }
}
