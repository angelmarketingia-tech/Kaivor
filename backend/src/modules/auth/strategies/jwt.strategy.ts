import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

function extractFromCookie(req: Request): string | null {
  if (!req || !req.cookies) return null;
  return req.cookies['kaivor_token'] || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      // Accept token from either httpOnly cookie OR Authorization header (legacy)
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractFromCookie as any,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'your_secret_key'),
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      tenantId: payload.tenant_id,
      role: payload.role,
    };
  }
}
