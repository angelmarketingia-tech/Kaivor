import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MessagesService } from './messages.service';

@Controller('messages')
@UseGuards(AuthGuard('jwt'))
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Get()
  list(@Request() req: any, @Query('channel') channel?: string) {
    return this.messages.list(req.user.tenantId, channel);
  }

  @Post()
  send(@Request() req: any, @Body() body: any) {
    return this.messages.send(req.user.tenantId, body);
  }

  @Get('templates')
  listTemplates(@Request() req: any) {
    return this.messages.listTemplates(req.user.tenantId);
  }

  @Post('templates')
  createTemplate(@Request() req: any, @Body() body: any) {
    return this.messages.createTemplate(req.user.tenantId, body);
  }

  @Patch('templates/:id')
  updateTemplate(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.messages.updateTemplate(req.user.tenantId, id, body);
  }

  @Delete('templates/:id')
  deleteTemplate(@Request() req: any, @Param('id') id: string) {
    return this.messages.deleteTemplate(req.user.tenantId, id);
  }
}
