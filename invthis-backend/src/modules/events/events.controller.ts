import { Controller, Get, Query } from "@nestjs/common";
import { EventsService } from "./events.service";

@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get("events")
  findEvents(
    @Query("assetId") assetId?: string,
    @Query("severity") severity?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ) {
    return this.events.findEvents({
      assetId,
      severity,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("logs")
  findLogs(
    @Query("assetId") assetId?: string,
    @Query("severity") severity?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ) {
    return this.events.findLogs({
      assetId,
      severity,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
