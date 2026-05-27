import { Controller, Get, Post, Body, Param, UseGuards, Query, Patch, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@UseGuards(AuthGuard('jwt'))
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get()
  async getTransactions(@Request() req: any, @Query('companyId') companyId?: string) {
    return this.transactionsService.getTransactions(req.user.tenantId, companyId);
  }

  @Get(':id')
  async getTransaction(@Request() req: any, @Param('id') id: string) {
    return this.transactionsService.getTransaction(id, req.user.tenantId);
  }

  @Post()
  async create(@Request() req: any, @Body() data: any) {
    return this.transactionsService.createTransaction(req.user.tenantId, req.user.userId, data);
  }

  @Patch(':id/status')
  async updateStatus(@Request() req: any, @Param('id') id: string, @Body('status') status: string) {
    return this.transactionsService.updateTransactionStatus(id, status, req.user.tenantId);
  }
}
