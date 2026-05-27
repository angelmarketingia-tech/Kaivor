import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ImportsService } from './imports.service';

@Controller('imports')
@UseGuards(AuthGuard('jwt'))
export class ImportsController {
  constructor(private imports: ImportsService) {}

  @Get()
  list(@Request() req: any) {
    return this.imports.list(req.user.tenantId);
  }

  @Post('preview')
  preview(@Body() body: any) {
    return this.imports.preview(body.entityType, body.headers || []);
  }

  @Post('confirm')
  confirm(@Request() req: any, @Body() body: any) {
    return this.imports.confirm(req.user.tenantId, body.entityType, body.mapping || {}, body.rows || [], body.fileName);
  }
}
