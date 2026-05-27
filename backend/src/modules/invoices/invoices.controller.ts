import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Patch,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
@UseGuards(AuthGuard('jwt'))
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get('stats')
  async getStats(@Request() req: any) {
    return this.invoicesService.getMonthlyStats(req.user.tenantId);
  }

  @Get()
  async getInvoices(
    @Request() req: any,
    @Query('companyId') companyId?: string,
  ) {
    // tenantId siempre viene del JWT — nunca del cliente
    return this.invoicesService.getInvoices(req.user.tenantId, companyId);
  }

  @Get(':id')
  async getInvoice(@Request() req: any, @Param('id') id: string) {
    return this.invoicesService.getInvoice(id, req.user.tenantId);
  }

  @Post()
  async create(@Request() req: any, @Body() data: any) {
    // Inyectar tenantId del JWT, no del body
    return this.invoicesService.createInvoice({
      ...data,
      tenantId: req.user.tenantId,
    }, req.user.tenantId);
  }

  @Patch(':id/status')
  async updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.invoicesService.updateInvoiceStatus(id, status, req.user.tenantId);
  }

  @Patch(':id/dian')
  async updateDianStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.invoicesService.updateDianStatus(id, data.dianStatus, req.user.tenantId, data.dianCude);
  }

  @Post(':id/send-whatsapp')
  async sendWhatsapp(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.invoicesService.sendWhatsapp(id, req.user.tenantId, body);
  }

  @Post(':id/print-log')
  async printLog(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.invoicesService.logPrint(id, req.user.tenantId, body);
  }
}
