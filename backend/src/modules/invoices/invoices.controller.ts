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
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // tenantId siempre viene del JWT — nunca del cliente
    return this.invoicesService.getInvoices(req.user.tenantId, companyId, {
      limit: limit !== undefined ? parseInt(limit, 10) : undefined,
      offset: offset !== undefined ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  async getInvoice(@Request() req: any, @Param('id') id: string) {
    return this.invoicesService.getInvoice(id, req.user.tenantId);
  }

  @Post()
  async create(@Request() req: any, @Body() data: any) {
    // Inyectar tenantId + userId del JWT, nunca del body
    return this.invoicesService.createInvoice({
      ...data,
      userId: req.user.userId,
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

  // NOTA DE SEGURIDAD: el endpoint cliente-escribible PATCH /:id/dian fue ELIMINADO.
  // Los campos dianStatus/dianCude/dianUuid representan el resultado oficial de la DIAN y
  // SOLO pueden ser escritos por el servidor tras una respuesta real del proveedor tecnológico
  // (módulo /dian). Permitir que el cliente los estampe habilitaba fraude fiscal (CUFE falso).

  @Post(':id/send-whatsapp')
  async sendWhatsapp(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.invoicesService.sendWhatsapp(id, req.user.tenantId, body);
  }

  @Post(':id/print-log')
  async printLog(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.invoicesService.logPrint(id, req.user.tenantId, body);
  }
}
