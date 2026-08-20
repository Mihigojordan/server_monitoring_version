import { Controller, Get } from '@nestjs/common';
import { PredictiveAnalyticsService } from './predictive-analytics.service';

@Controller('infra/predictive-analytics')
export class PredictiveAnalyticsController {
  constructor(private readonly predictive: PredictiveAnalyticsService) {}

  @Get('servers')
  getServers() {
    return this.predictive.predictServers();
  }

  @Get('storage')
  getStorage() {
    return this.predictive.predictStorage();
  }

  @Get('switches')
  getSwitches() {
    return this.predictive.predictSwitches();
  }
}
