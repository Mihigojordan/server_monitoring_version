import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseModule } from './firebase/firebase.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PredictiveAnalyticsModule } from './predictive-analytics/predictive-analytics.module';
import { ResourceUtilizationModule } from './resource-utilization/resource-utilization.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FirebaseModule,
    AnalyticsModule,
    PredictiveAnalyticsModule,
    ResourceUtilizationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
