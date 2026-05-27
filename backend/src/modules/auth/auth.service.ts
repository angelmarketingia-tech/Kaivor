import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { encrypt, decrypt } from '@/common/crypto.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
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
    const { email, password } = dto;

    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
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

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
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

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, tenantId: true, isActive: true, mfaEnabled: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const subscription = await this.subscriptionsService.getCurrentSubscription(user.tenantId);
    return { user: { ...user, plan: subscription.plan } };
  }
}
