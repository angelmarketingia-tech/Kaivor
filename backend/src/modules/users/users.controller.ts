import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async getUser(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Get('tenant/:tenantId')
  @UseGuards(AuthGuard('jwt'))
  async getTenantUsers(@Param('tenantId') tenantId: string) {
    return this.usersService.getUsersByTenant(tenantId);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async create(@Body() data: any) {
    return this.usersService.createUser(data);
  }
}
