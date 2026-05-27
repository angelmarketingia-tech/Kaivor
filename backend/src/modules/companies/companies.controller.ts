import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompaniesService } from './companies.service';

@Controller('companies')
@UseGuards(AuthGuard('jwt'))
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Get('my')
  async getMyCompany(@Request() req: any) {
    return this.companiesService.getMyCompany(req.user.tenantId);
  }

  @Patch('my')
  async updateMyCompany(@Request() req: any, @Body() data: any) {
    return this.companiesService.updateMyCompany(req.user.tenantId, data);
  }
}
