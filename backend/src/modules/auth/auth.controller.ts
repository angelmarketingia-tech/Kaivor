import { Controller, Post, Get, Body, Res, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const, // cross-site (kaivor.vercel.app → kaivor-api.vercel.app)
  maxAge: SEVEN_DAYS_MS,
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Strict rate limit on auth endpoints to prevent brute force
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    res.cookie('kaivor_token', result.access_token, COOKIE_OPTS);
    return result;
  }

  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    if (result.access_token) {
      res.cookie('kaivor_token', result.access_token, COOKIE_OPTS);
    }
    return result;
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('kaivor_token', { ...COOKIE_OPTS, maxAge: 0 });
    return { ok: true };
  }

  // ── MFA / TOTP ──
  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/setup')
  async mfaSetup(@Req() req: any) {
    return this.authService.mfaSetup(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/enable')
  async mfaEnable(@Req() req: any, @Body() body: { code: string }) {
    return this.authService.mfaEnable(req.user.userId, body.code);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/disable')
  async mfaDisable(@Req() req: any, @Body() body: { code: string }) {
    return this.authService.mfaDisable(req.user.userId, body.code);
  }

  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @Post('mfa/verify')
  async mfaVerify(@Body() body: { userId: string; code: string }, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.mfaVerify(body.userId, body.code);
    if (result.access_token) {
      res.cookie('kaivor_token', result.access_token, COOKIE_OPTS);
    }
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async me(@Req() req: any) {
    return this.authService.me(req.user.userId);
  }
}
