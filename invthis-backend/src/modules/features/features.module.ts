import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Metric } from "../../entities/metric.entity";
import { LogEntry } from "../../entities/log-entry.entity";
import { PredictiveFeature } from "../../entities/predictive-feature.entity";
import { PredictionLabel } from "../../entities/prediction-label.entity";
import { FeaturesService } from "./features.service";
import { LabelsService } from "./labels.service";
import { FeaturesController } from "./features.controller";
import { IncidentsModule } from "../incidents/incidents.module";
import { MaintenanceModule } from "../maintenance/maintenance.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Metric,
      LogEntry,
      PredictiveFeature,
      PredictionLabel,
    ]),
    IncidentsModule,
    MaintenanceModule,
  ],
  providers: [FeaturesService, LabelsService],
  controllers: [FeaturesController],
  exports: [FeaturesService, LabelsService],
})
export class FeaturesModule {}
