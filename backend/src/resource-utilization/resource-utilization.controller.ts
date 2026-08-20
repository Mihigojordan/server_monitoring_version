import { Controller, Get } from '@nestjs/common';
import { ResourceUtilizationService } from './resource-utilization.service';

@Controller('infra/resource-utilization')
export class ResourceUtilizationController {
  constructor(private readonly utilization: ResourceUtilizationService) {}

  @Get('summary')
  getSummary() {
    return this.utilization.getSummary();
  }
}
