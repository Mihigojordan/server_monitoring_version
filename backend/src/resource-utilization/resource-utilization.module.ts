import { Module } from '@nestjs/common';
import { DeviceDataService } from '../predictive-analytics/device-data.service';
import { ResourceUtilizationController } from './resource-utilization.controller';
import { ResourceUtilizationService } from './resource-utilization.service';

@Module({
  controllers: [ResourceUtilizationController],
  providers: [DeviceDataService, ResourceUtilizationService],
})
export class ResourceUtilizationModule {}
