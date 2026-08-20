import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('infra/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('equipment-risk')
  getEquipmentRisk() {
    return this.analyticsService.getEquipmentRisk();
  }
}
