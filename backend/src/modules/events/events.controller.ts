import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EventsService } from './events.service';

@Controller('events')
@UseGuards(AuthGuard('jwt'))
export class EventsController {
  constructor(private events: EventsService) {}

  @Get()
  list(@Request() req: any) {
    return this.events.list(req.user.tenantId);
  }
}
