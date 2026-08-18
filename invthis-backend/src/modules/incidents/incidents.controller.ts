import { Controller, Get, Query } from "@nestjs/common";
import { IncidentsService } from "./incidents.service";

@Controller("infrastructure/incidents")
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get()
  findAll(
    @Query("assetId") assetId?: string,
    @Query("incidentType") incidentType?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ) {
    return this.incidents.findAll({
      assetId,
      incidentType,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("active")
  active() {
    return this.incidents.active();
  }
}
