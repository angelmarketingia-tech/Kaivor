import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AutomationsService } from './automations.service';

@Controller('automations')
@UseGuards(AuthGuard('jwt'))
export class AutomationsController {
  constructor(private automations: AutomationsService) {}

  @Get()
  list(@Request() req: any) {
    return this.automations.list(req.user.tenantId);
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.automations.create(req.user.tenantId, body);
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.automations.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.automations.remove(req.user.tenantId, id);
  }

  @Post(':id/run')
  run(@Request() req: any, @Param('id') id: string) {
    return this.automations.run(req.user.tenantId, id);
  }
}
