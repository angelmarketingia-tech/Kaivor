import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(AuthGuard('jwt'))
export class OnboardingController {
  constructor(private onboarding: OnboardingService) {}

  @Get()
  get(@Request() req: any) {
    return this.onboarding.get(req.user.tenantId);
  }

  @Patch()
  update(@Request() req: any, @Body() body: any) {
    return this.onboarding.update(req.user.tenantId, body);
  }
}
