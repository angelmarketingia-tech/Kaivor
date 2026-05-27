import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
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
}
