import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DianService } from './dian.service';

@Controller('dian')
@UseGuards(AuthGuard('jwt'))
export class DianController {
  constructor(private dian: DianService) {}

  @Get('status')
  status(@Request() req: any) {
    return this.dian.getStatus(req.user.tenantId);
  }

  @Post('invoices/:id/submit')
  submit(@Request() req: any, @Param('id') id: string) {
    return this.dian.submitInvoice(req.user.tenantId, id);
  }

  @Get('invoices/:id/status')
  invoiceStatus(@Request() req: any, @Param('id') id: string) {
    return this.dian.retrieveStatus(req.user.tenantId, id);
  }
}
