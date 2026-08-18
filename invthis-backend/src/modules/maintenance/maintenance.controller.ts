import { Controller, Get, Query } from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service";

@Controller()
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get("maintenance")
  findMaintenance(@Query("assetId") assetId?: string) {
    return this.maintenance.findMaintenance(assetId);
  }

  @Get("configuration-changes")
  findConfigChanges(@Query("assetId") assetId?: string) {
    return this.maintenance.findConfigChanges(assetId);
  }
}
