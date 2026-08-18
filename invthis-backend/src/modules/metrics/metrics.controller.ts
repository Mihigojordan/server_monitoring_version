import { Controller, Get, Param, Query } from "@nestjs/common";
import { MetricsService } from "./metrics.service";

// Spec asks for /servers/:id/metrics, /storage/:id/metrics, /switches/:id/metrics
// as distinct paths; underneath they're all the same generic metrics table
// keyed by assetId, so these are thin aliases over the same service.
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get("assets/:id/metrics")
  forAsset(
    @Param("id") id: string,
    @Query("metricName") metricName?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ) {
    return this.metrics.forAsset(id, {
      metricName,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("servers/:id/metrics")
  forServer(
    @Param("id") id: string,
    @Query("metricName") metricName?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.metrics.forAsset(id, { metricName, from, to });
  }

  @Get("storage/:id/metrics")
  forStorage(
    @Param("id") id: string,
    @Query("metricName") metricName?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.metrics.forAsset(id, { metricName, from, to });
  }

  @Get("switches/:id/metrics")
  forSwitch(
    @Param("id") id: string,
    @Query("metricName") metricName?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.metrics.forAsset(id, { metricName, from, to });
  }
}
