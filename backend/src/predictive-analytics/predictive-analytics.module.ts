import { Module } from '@nestjs/common';
import { DeviceDataService } from './device-data.service';
import { PredictiveAnalyticsController } from './predictive-analytics.controller';
import { PredictiveAnalyticsService } from './predictive-analytics.service';

@Module({
  controllers: [PredictiveAnalyticsController],
  providers: [DeviceDataService, PredictiveAnalyticsService],
})
export class PredictiveAnalyticsModule {}
