import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Asset } from "../../entities/asset.entity";
import { PredictiveFeature } from "../../entities/predictive-feature.entity";
import { PredictionLabel } from "../../entities/prediction-label.entity";
import { InfrastructureService } from "./infrastructure.service";
import { InfrastructureController } from "./infrastructure.controller";
import { IncidentsModule } from "../incidents/incidents.module";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, PredictiveFeature, PredictionLabel]),
    IncidentsModule,
    EventsModule,
  ],
  providers: [InfrastructureService],
  controllers: [InfrastructureController],
})
export class InfrastructureModule {}
