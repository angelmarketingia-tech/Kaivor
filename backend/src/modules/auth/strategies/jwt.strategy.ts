import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PrismaService } from '@/prisma/prisma.service';
import { effectivePermissions } from '@/common/permissions';

function extractFromCookie(req: Request): string | null {
  if (!req || !req.cookies) return null;
  return req.cookies['kaivor_token'] || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService, private prisma: PrismaService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not set — refusing to start with an insecure fallback secret');
    }
    super({
      // Accept token from either httpOnly cookie OR Authorization header (legacy)
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractFromCookie as any,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    // Resolve effective permissions fresh from DB so changes apply without re-login.
    let permissions: Record<string, boolean> = {};
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { role: true, permissions: true, isActive: true },
      });
      if (user) {
        permissions = effectivePermissions(user.role, (user.permissions as any) || null);
      }
    } catch {
      // On DB hiccup, fall back to role-only (guards will use role defaults).
      permissions = effectivePermissions(payload.role, null);
    }
    return {
      userId: payload.sub,
      email: payload.email,
      tenantId: payload.tenant_id,
      role: payload.role,
      permissions,
    };
  }
}
