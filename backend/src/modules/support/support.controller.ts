import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SupportService } from './support.service';

@Controller('support')
@UseGuards(AuthGuard('jwt'))
export class SupportController {
  constructor(private support: SupportService) {}

  @Get('tickets')
  list(@Request() req: any) {
    return this.support.list(req.user.tenantId);
  }

  @Post('tickets')
  create(@Request() req: any, @Body() body: any) {
    return this.support.create(req.user.tenantId, req.user.userId, req.user.email, body);
  }
}
