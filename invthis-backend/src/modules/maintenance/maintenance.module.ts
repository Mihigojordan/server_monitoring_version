import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MaintenanceRecord } from "../../entities/maintenance-record.entity";
import { ConfigurationChange } from "../../entities/configuration-change.entity";
import { MaintenanceService } from "./maintenance.service";
import { MaintenanceController } from "./maintenance.controller";

@Module({
  imports: [TypeOrmModule.forFeature([MaintenanceRecord, ConfigurationChange])],
  providers: [MaintenanceService],
  controllers: [MaintenanceController],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
