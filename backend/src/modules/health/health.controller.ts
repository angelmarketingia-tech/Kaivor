import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'admia-backend',
      version: '1.0.0',
    };
  }

  @Get('ready')
  ready() {
    return {
      ready: true,
      timestamp: new Date().toISOString(),
    };
  }
}
