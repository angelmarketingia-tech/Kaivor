import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AccountsService } from './accounts.service';

@Controller('accounts')
@UseGuards(AuthGuard('jwt'))
export class AccountsController {
  constructor(private accounts: AccountsService) {}

  @Get()
  list(@Request() req: any) {
    return this.accounts.list(req.user.tenantId);
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.accounts.create(req.user.tenantId, body);
  }

  @Post('switch')
  switch(@Request() req: any, @Body('accountId') accountId: string) {
    return this.accounts.switch(req.user.tenantId, accountId);
  }
}
